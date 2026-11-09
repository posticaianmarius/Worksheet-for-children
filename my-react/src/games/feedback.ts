// Keep answer and completion sounds mutually exclusive, including pending playback.
let currentSound: HTMLAudioElement | null = null;
let currentKind: keyof typeof feedbackSounds | null = null;

export const feedbackSounds = {
  correct: "/sounds/correct-answer-tone.wav",
  incorrect: "/sounds/wrong-answer-fail-notification.wav",
  complete: "/sounds/correct-answer-reward.wav",
};

export function stopGameFeedback({ preserveCompletion = false } = {}) {
  if (preserveCompletion && currentKind === "complete") return;
  currentSound?.pause();
  currentSound = null;
  currentKind = null;
}

function playFeedback(kind: keyof typeof feedbackSounds) {
  stopGameFeedback();
  try {
    const sound = new Audio(feedbackSounds[kind]);
    sound.volume = 0.5;
    currentSound = sound;
    currentKind = kind;
    void sound
      .play()
      .then(() => {
        if (currentSound !== sound) sound.pause();
      })
      .catch(() => {
        // Muted devices, blocked autoplay, and failed audio must not interrupt play.
        if (currentSound === sound) {
          currentSound = null;
          currentKind = null;
        }
      });
  } catch {
    currentSound = null;
    currentKind = null;
  }
}

export function playAnswerFeedback(correct: boolean) {
  playFeedback(correct ? "correct" : "incorrect");
}

export function playTaskComplete() {
  playFeedback("complete");
}
