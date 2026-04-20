// src/pages/SkillTree.jsx
// Renders the interactive skill tree using React Flow.
// Nodes are color-coded by state: locked / unlocked / completed.
// Locked nodes are not clickable.

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";

import Navbar from "../components/Navbar";
import Loader from "../components/Loader";
import SkillNode from "../components/SkillNode";
import { getTopics, getSkills } from "../services/topicService";
import { useProgress } from "../hooks/useProgress";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

// Register the custom node type
const nodeTypes = { skillNode: SkillNode };

export default function SkillTree() {
  const { id: skillId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const userId = user?.uid || "guest";

  const [allTopics, setAllTopics] = useState([]);
  const [skillName, setSkillName] = useState("");
  const [dataLoading, setDataLoading] = useState(true);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const { isTopicUnlocked, completedMap, loading: progressLoading } = useProgress();

  // ── Fetch data ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchData() {
      try {
        const [topicsData, skillsData] = await Promise.all([
          getTopics(userId),
          getSkills(userId),
        ]);

        // Filter to topics belonging to this skill
        const skill = skillsData.find((s) => s.id === skillId);
        if (skill) {
          setSkillName(skill.name);
          const skillTopics = topicsData.filter((t) =>
            skill.topics.includes(t.id)
          );
          setAllTopics(skillTopics);
        }
      } catch (err) {
        console.error("Failed to load skill tree:", err);
      } finally {
        setDataLoading(false);
      }
    }
    fetchData();
  }, [skillId, userId]);

  // ── Build nodes & edges when topic data or progress changes ────────────
  // Theme is intentionally excluded here — edge color reacts to theme in
  // a separate, lighter effect below (fix #11).
  useEffect(() => {
    if (allTopics.length === 0) return;

    const builtNodes = allTopics.map((topic) => {
      const isCompleted = completedMap[topic.id] === true;
      const isUnlocked = isTopicUnlocked(topic);

      let state = "locked";
      if (isCompleted) state = "completed";
      else if (isUnlocked) state = "unlocked";

      return {
        id: topic.id,
        type: "skillNode",
        position: topic.position || { x: 100, y: 100 },
        data: {
          label: topic.title,
          state,
          onClick: () => navigate(`/topic/${topic.id}`),
        },
      };
    });

    // Build edges from prerequisites — use a neutral stroke; the theme
    // effect below will update colors without rebuilding all nodes.
    const builtEdges = [];
    allTopics.forEach((topic) => {
      (topic.prerequisites || []).forEach((prereqId) => {
        builtEdges.push({
          id: `${prereqId}->${topic.id}`,
          source: prereqId,
          target: topic.id,
          animated: completedMap[prereqId] === true,
          style: {
            stroke: completedMap[prereqId] === true
              ? "#1db954"
              : theme === "light" ? "#94a3b8" : "#3a3a3a",
            strokeWidth: 2,
          },
        });
      });
    });

    setNodes(builtNodes);
    setEdges(builtEdges);
  }, [allTopics, completedMap, isTopicUnlocked, navigate, setNodes, setEdges, theme]);

  // ── Lightweight effect: update edge colors only when theme changes ───────
  // This avoids rebuilding all nodes just because the user toggled dark/light.
  useEffect(() => {
    setEdges((prev) =>
      prev.map((edge) => {
        // Don't override the green "completed" stroke
        if (edge.style?.stroke === "#1db954") return edge;
        return {
          ...edge,
          style: {
            ...edge.style,
            stroke: theme === "light" ? "#94a3b8" : "#3a3a3a",
          },
        };
      })
    );
  }, [theme, setEdges]);

  if (dataLoading || progressLoading) return <Loader message="Loading skill tree..." />;

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />

      {/* Header bar */}
      <div className="pt-20 px-6 pb-4 border-b border-neutral-800">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate("/dashboard")}
              className="text-gray-500 text-sm hover:text-white transition-colors mb-1 block"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold text-white">{skillName}</h1>
          </div>

          {/* Legend */}
          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-neutral-700 inline-block" />
              Locked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
              Unlocked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-green-600 inline-block" />
              Completed
            </span>
          </div>
        </div>
      </div>

      {/* React Flow canvas — needs explicit pixel height to render */}
      <div style={{ height: "calc(100vh - 145px)", width: "100%" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.4}
          maxZoom={1.8}
          proOptions={{ hideAttribution: true }}
        >
          <Background color={theme === "light" ? "#d6dce8" : "#1f1f1f"} gap={24} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const s = node.data?.state;
              if (s === "completed") return "#1db954";
              if (s === "unlocked") return "#e50914";
              return "#3a3a3a";
            }}
            maskColor={theme === "light" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)"}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
