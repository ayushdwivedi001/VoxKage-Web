export type BuildMode = "Work" | "Plan";

export function getStoredBuildMode(): BuildMode {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("voxkage_build_mode");
    if (saved === "Plan" || saved === "Work") {
      return saved;
    }
  }
  return "Work";
}

export function setStoredBuildMode(mode: BuildMode) {
  if (typeof window !== "undefined") {
    localStorage.setItem("voxkage_build_mode", mode);
    window.dispatchEvent(new CustomEvent("voxkage_build_mode_change", { detail: mode }));
  }
}
