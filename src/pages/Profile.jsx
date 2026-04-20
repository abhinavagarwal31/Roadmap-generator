import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "../components/Navbar";
import Loader from "../components/Loader";
import { useAuth } from "../context/AuthContext";
import { getSkills, getTopics, getUserProgress } from "../services/topicService";
import {
  generateProfileMessage,
  getUserProfileDetails,
  saveUserProfileDetails,
} from "../services/profileService";

export default function Profile() {
  const navigate = useNavigate();
  const { user, changePassword, updateDisplayName, isDemoMode } = useAuth();

  const userId = user?.uid || "guest";

  const [skills, setSkills] = useState([]);
  const [topics, setTopics] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [dataLoading, setDataLoading] = useState(true);

  const [profileMessage, setProfileMessage] = useState("");
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState("");

  const [profileDraft, setProfileDraft] = useState({
    displayName: "",
    studyGoal: "",
    focusArea: "",
    weeklyStudyHours: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileNotice, setProfileNotice] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [skillsData, topicsData, progressData, profileData] = await Promise.all([
          getSkills(userId),
          getTopics(userId),
          getUserProgress(userId),
          getUserProfileDetails(userId),
        ]);

        if (!isMounted) return;
        setSkills(skillsData || []);
        setTopics(topicsData || []);
        setProgressMap(progressData || {});

        const fallbackName = user?.displayName || user?.email?.split("@")[0] || "Learner";
        setProfileDraft({
          displayName: profileData?.displayName || fallbackName,
          studyGoal: profileData?.studyGoal || "",
          focusArea: profileData?.focusArea || "",
          weeklyStudyHours:
            typeof profileData?.weeklyStudyHours === "number" && profileData.weeklyStudyHours > 0
              ? String(profileData.weeklyStudyHours)
              : "",
        });
      } catch (err) {
        console.error("Failed to load profile data:", err);
      } finally {
        if (isMounted) setDataLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [userId, user?.displayName, user?.email]);

  const stats = useMemo(() => {
    const totalTopics = topics.length;
    const completedTopics = Object.values(progressMap).filter(Boolean).length;
    const completionRate = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

    return {
      tracks: skills.length,
      totalTopics,
      completedTopics,
      completionRate,
    };
  }, [skills.length, topics.length, progressMap]);

  useEffect(() => {
    if (dataLoading || !user || profileMessage) return;
    handleGenerateProfileMessage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoading, user?.uid, profileMessage]);

  async function handleGenerateProfileMessage(overrideDisplayName) {
    if (!user) return;

    setMessageLoading(true);
    setMessageError("");

    try {
      const preferredName =
        (overrideDisplayName || "").trim() ||
        profileDraft.displayName.trim() ||
        user.displayName ||
        user.email?.split("@")[0] ||
        "Learner";

      const generated = await generateProfileMessage({
        displayName: preferredName,
        stats,
      });
      setProfileMessage(generated);
    } catch (err) {
      setMessageError(err?.message || "Could not generate your study message right now.");
    } finally {
      setMessageLoading(false);
    }
  }

  async function handleProfileSave(e) {
    e.preventDefault();
    setProfileError("");
    setProfileNotice("");

    const displayName = profileDraft.displayName.trim();
    const studyGoal = profileDraft.studyGoal.trim();
    const focusArea = profileDraft.focusArea.trim();
    const weeklyStudyHoursValue = Number(profileDraft.weeklyStudyHours);

    if (!displayName) {
      setProfileError("Display name cannot be empty.");
      return;
    }

    if (displayName.length < 2) {
      setProfileError("Display name should be at least 2 characters.");
      return;
    }

    const weeklyStudyHours = Number.isFinite(weeklyStudyHoursValue)
      ? Math.max(0, Math.min(168, Math.round(weeklyStudyHoursValue)))
      : 0;

    setProfileSaving(true);
    try {
      await updateDisplayName(displayName);

      const savedProfile = await saveUserProfileDetails(userId, {
        displayName,
        studyGoal,
        focusArea,
        weeklyStudyHours,
      });

      setProfileDraft({
        displayName: savedProfile.displayName || displayName,
        studyGoal: savedProfile.studyGoal || "",
        focusArea: savedProfile.focusArea || "",
        weeklyStudyHours:
          typeof savedProfile.weeklyStudyHours === "number" && savedProfile.weeklyStudyHours > 0
            ? String(savedProfile.weeklyStudyHours)
            : "",
      });

      setProfileNotice("Profile details updated.");
      await handleGenerateProfileMessage(displayName);
    } catch (err) {
      setProfileError(err?.message || "Could not save profile details.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordUpdate(e) {
    e.preventDefault();
    setPasswordError("");
    setPasswordNotice("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Please fill all password fields.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordNotice("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (err) {
      setPasswordError(mapPasswordError(err));
    } finally {
      setPasswordSaving(false);
    }
  }

  if (dataLoading) return <Loader message="Loading your profile..." />;

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 pt-24 pb-16 animate-fade-in">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
          <div>
            <button
              onClick={() => navigate("/dashboard")}
              className="text-gray-500 text-sm hover:text-white transition-colors mb-1 block"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-white">Your Profile</h1>
            <p className="text-gray-500 text-sm mt-1">
              Track your progress, get AI encouragement, and manage account security.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerateProfileMessage}
            disabled={messageLoading}
            className="rounded border border-accent-red px-4 py-2 text-sm font-medium text-accent-red
                       hover:bg-accent-red hover:text-white transition-colors disabled:opacity-50"
          >
            {messageLoading ? "Generating..." : "Regenerate AI Message"}
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="bg-bg-card border border-neutral-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Profile Details</h2>

            <form onSubmit={handleProfileSave} className="grid gap-4 sm:grid-cols-2">
              <ProfileInput
                id="display-name"
                label="Display Name"
                value={profileDraft.displayName}
                onChange={(value) => setProfileDraft((prev) => ({ ...prev, displayName: value }))}
                required
              />

              <ProfileInput
                id="focus-area"
                label="Primary Focus"
                value={profileDraft.focusArea}
                onChange={(value) => setProfileDraft((prev) => ({ ...prev, focusArea: value }))}
                placeholder="Example: Web Development, DSA, ML"
              />

              <ProfileInput
                id="weekly-hours"
                label="Weekly Study Hours"
                type="number"
                min="0"
                max="168"
                value={profileDraft.weeklyStudyHours}
                onChange={(value) => setProfileDraft((prev) => ({ ...prev, weeklyStudyHours: value }))}
                placeholder="10"
              />

              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-400 mb-1" htmlFor="study-goal">
                  Study Goal
                </label>
                <textarea
                  id="study-goal"
                  rows={3}
                  value={profileDraft.studyGoal}
                  onChange={(e) =>
                    setProfileDraft((prev) => ({
                      ...prev,
                      studyGoal: e.target.value,
                    }))
                  }
                  placeholder="Write your current learning goal..."
                  className="w-full resize-none rounded border border-neutral-700 bg-bg-elevated px-3 py-2.5 text-sm
                             text-white placeholder-gray-600 outline-none focus:border-accent-red"
                />
              </div>

              {profileError && (
                <p className="sm:col-span-2 text-sm text-red-400 bg-red-950 border border-red-900 rounded px-3 py-2">
                  {profileError}
                </p>
              )}

              {profileNotice && (
                <p className="sm:col-span-2 text-sm text-green-400 bg-green-950 border border-green-800 rounded px-3 py-2">
                  {profileNotice}
                </p>
              )}

              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="rounded border border-accent-red bg-accent-red px-4 py-2.5 text-sm font-medium text-white
                             hover:bg-accent-redHover transition-colors disabled:opacity-50"
                >
                  {profileSaving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>

            <div className="mt-6 border-t border-neutral-800 pt-5 space-y-3 text-sm">
              <h3 className="text-sm font-semibold text-white">Account Info</h3>
              <DetailRow label="Email" value={user?.email || "Not available"} />
              <DetailRow label="User ID" value={user?.uid || "Not available"} mono />
              <DetailRow label="Mode" value={isDemoMode ? "Demo mode" : "Firebase mode"} />
              <DetailRow
                label="Account Created"
                value={
                  user?.metadata?.creationTime
                    ? new Date(user.metadata.creationTime).toLocaleString()
                    : "Not available"
                }
              />
            </div>
          </section>

          <section className="bg-bg-card border border-neutral-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Study Snapshot</h2>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <StatCard label="Tracks" value={stats.tracks} />
              <StatCard label="Topics" value={stats.totalTopics} />
              <StatCard label="Completed" value={stats.completedTopics} />
              <StatCard label="Completion" value={`${stats.completionRate}%`} />
            </div>

            {messageError ? (
              <p className="text-sm text-red-400 bg-red-950 border border-red-900 rounded px-3 py-2">
                {messageError}
              </p>
            ) : (
              <div className="rounded border border-green-800 bg-green-950 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wider text-green-400 mb-1">AI Appreciation</p>
                <p className="text-sm text-green-400 leading-relaxed">
                  {profileMessage || (messageLoading ? "Generating your personalized message..." : "No message yet.")}
                </p>
              </div>
            )}
          </section>
        </div>

        <section className="mt-6 bg-bg-card border border-neutral-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-1">Password Settings</h2>
          <p className="text-xs text-gray-500 mb-4">
            For security, your current password cannot be read from the system. Enter it below and use the
            toggle to view what you type.
          </p>

          <form onSubmit={handlePasswordUpdate} className="grid gap-4 sm:grid-cols-2">
            <PasswordField
              id="current-password"
              label="Current Password"
              value={currentPassword}
              onChange={setCurrentPassword}
              visible={showCurrentPassword}
              setVisible={setShowCurrentPassword}
            />

            <div />

            <PasswordField
              id="new-password"
              label="New Password"
              value={newPassword}
              onChange={setNewPassword}
              visible={showNewPassword}
              setVisible={setShowNewPassword}
            />

            <PasswordField
              id="confirm-password"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              visible={showConfirmPassword}
              setVisible={setShowConfirmPassword}
            />

            {passwordError && (
              <p className="sm:col-span-2 text-sm text-red-400 bg-red-950 border border-red-900 rounded px-3 py-2">
                {passwordError}
              </p>
            )}

            {passwordNotice && (
              <p className="sm:col-span-2 text-sm text-green-400 bg-green-950 border border-green-800 rounded px-3 py-2">
                {passwordNotice}
              </p>
            )}

            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={passwordSaving}
                className="rounded border border-accent-red bg-accent-red px-4 py-2.5 text-sm font-medium text-white
                           hover:bg-accent-redHover transition-colors disabled:opacity-50"
              >
                {passwordSaving ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

function DetailRow({ label, value, mono = false }) {
  return (
    <div className="flex flex-col gap-1 border border-neutral-800 rounded px-3 py-2.5 bg-bg-elevated">
      <span className="text-[11px] uppercase tracking-wider text-gray-600">{label}</span>
      <span className={`text-sm text-white ${mono ? "font-mono break-all" : ""}`}>{value}</span>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded border border-neutral-800 bg-bg-elevated px-3 py-3">
      <p className="text-[11px] uppercase tracking-wider text-gray-600">{label}</p>
      <p className="text-xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function PasswordField({ id, label, value, onChange, visible, setVisible }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1" htmlFor={id}>
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          className="w-full rounded border border-neutral-700 bg-bg-elevated px-3 py-2.5 text-sm text-white
                     placeholder-gray-600 outline-none focus:border-accent-red"
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          className="rounded border border-neutral-700 px-3 py-2 text-xs text-gray-300
                     hover:border-accent-red hover:text-white transition-colors"
          title={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

function ProfileInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
  min,
  max,
}) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        min={min}
        max={max}
        className="w-full rounded border border-neutral-700 bg-bg-elevated px-3 py-2.5 text-sm
                   text-white placeholder-gray-600 outline-none focus:border-accent-red"
      />
    </div>
  );
}

function mapPasswordError(error) {
  const code = error?.code;
  const message = (error?.message || "").toLowerCase();

  const map = {
    "auth/wrong-password": "Current password is incorrect.",
    "auth/invalid-credential": "Current password is incorrect.",
    "auth/weak-password": "New password is too weak. Use at least 6 characters.",
    "auth/requires-recent-login": "Please log in again and retry password update.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
  };

  if (code && map[code]) return map[code];
  if (message.includes("current password is incorrect")) return "Current password is incorrect.";
  return error?.message || "Could not update password right now.";
}
