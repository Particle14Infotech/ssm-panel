export type StageId = "hero" | "pipeline" | "closing";

export interface StageStore {
  currentStage: StageId;
  pipelineT: number;
  scrollProgress: number;
  setPipelineT: (t: number) => void;
  setStage: (stage: StageId) => void;
}

export const stageStore: StageStore = {
  currentStage: "hero",
  pipelineT: 0,
  scrollProgress: 0,
  setPipelineT(t: number) {
    this.pipelineT = Math.max(0, Math.min(1, t));
  },
  setStage(stage: StageId) {
    this.currentStage = stage;
  },
};
