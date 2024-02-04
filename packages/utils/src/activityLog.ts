const instances = {};
type ActivityLogParams = {
  title: string;
  id: string;
  totalSteps: number;
  onStep: (params: ActivityLogEmitParams) => void;
};

type ActivityLogEmitParams = {
  message: string;
  success?: boolean;
  step?: number;
  totalSteps?: number;
  completed?: boolean;
  aborted?: boolean;
  init?: boolean;
  id?: string;
  logId?: string;
};
export class ActivityLog {
  logId = Math.random().toString(36).substring(7);
  title: string;
  id: string;
  totalSteps: number;
  onStep: (params: ActivityLogEmitParams) => void;
  currentStep = 0;

  constructor({ title, id, totalSteps, onStep }: ActivityLogParams) {
    this.title = title;
    this.id = id;
    this.totalSteps = totalSteps;
    this.onStep = onStep;
    this.init();
  }

  static init(params: ActivityLogParams): ActivityLog {
    if (instances[params.id]) {
      instances[params.id].abort({ message: "Activity aborted" });
      delete instances[params.id];
    }
    instances[params.id] = new ActivityLog(params);
    return instances[params.id];
  }

  init() {
    const initPayload = {
      message: this.title,
      init: true,
    };
    this.emit(initPayload);
  }

  emit(payload: ActivityLogEmitParams) {
    this.onStep({
      ...payload,
      totalSteps: this.totalSteps,
      logId: this.logId,
      id: this.id,
    });
    if (payload.completed) {
      delete instances[this.id];
    }
  }

  abort({ message }: { message: string }) {
    const payload = {
      message,
      aborted: true,
    };
    this.emit(payload);
  }

  logActivity({ message, success }: { message: string; success: boolean }) {
    this.currentStep += 1;

    const payload = {
      message,
      success,
      step: this.currentStep,
      totalSteps: this.totalSteps,
      completed: false,
    };

    if (this.currentStep === this.totalSteps) {
      payload.completed = true;
    }

    this.emit(payload);
  }
}
