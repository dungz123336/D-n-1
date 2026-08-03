"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceStatus =
  | "idle"
  | "listening"
  | "processing"
  | "unsupported"
  | "denied"
  | "no-speech"
  | "network"
  | "error"
  | "paused";

type Options = {
  lang?: string;
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { isFinal: boolean; [index: number]: { transcript: string } }[];
};
type SpeechRecognitionErrorLike = { error?: string };
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
type SpeechWindow = {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

/**
 * Robust Web Speech API wrapper for Vietnamese search.
 * Starts only on user gesture; cleans up on unmount.
 * Supports stop / pause / restart and graceful error mapping.
 */
export function useVoiceSearch({ lang = "vi-VN", onFinal, onInterim }: Options) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const intentionalStop = useRef(false);
  const pausedRef = useRef(false);
  const errorRef = useRef("");
  const onFinalRef = useRef(onFinal);
  const onInterimRef = useRef(onInterim);

  useEffect(() => {
    onFinalRef.current = onFinal;
    onInterimRef.current = onInterim;
  }, [onFinal, onInterim]);

  useEffect(() => {
    return () => {
      intentionalStop.current = true;
      try {
        recRef.current?.abort?.();
        recRef.current?.stop?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const mapError = (code: string): { status: VoiceStatus; message: string } => {
    switch (code) {
      case "not-allowed":
      case "service-not-allowed":
        return {
          status: "denied",
          message: "Bạn cần cho phép quyền micro để tìm bằng giọng nói. Kiểm tra cài đặt trình duyệt.",
        };
      case "no-speech":
        return {
          status: "no-speech",
          message: "Không nghe thấy giọng nói. Thử lại gần micro hơn, nói rõ: “Tìm sách AI”.",
        };
      case "network":
        return {
          status: "network",
          message: "Lỗi mạng khi nhận giọng nói. Kiểm tra kết nối internet rồi thử lại.",
        };
      case "audio-capture":
        return {
          status: "error",
          message: "Không tìm thấy micro. Kiểm tra thiết bị âm thanh rồi thử lại.",
        };
      case "aborted":
        return { status: "idle", message: "" };
      default:
        return {
          status: "error",
          message: "Không nhận diện được. Bấm micro để thử lại.",
        };
    }
  };

  const hardStop = useCallback(() => {
    intentionalStop.current = true;
    pausedRef.current = false;
    try {
      recRef.current?.abort?.();
      recRef.current?.stop?.();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setStatus("idle");
  }, []);

  const stop = useCallback(() => {
    intentionalStop.current = true;
    pausedRef.current = false;
    try {
      recRef.current?.stop?.();
    } catch {
      /* ignore */
    }
    setStatus((s) => (s === "listening" ? "processing" : s === "paused" ? "idle" : s));
  }, []);

  const pause = useCallback(() => {
    if (status !== "listening") return;
    intentionalStop.current = true;
    pausedRef.current = true;
    try {
      recRef.current?.stop?.();
    } catch {
      /* ignore */
    }
    setStatus("paused");
  }, [status]);

  const start = useCallback(() => {
    setErrorMessage("");
    errorRef.current = "";
    finalRef.current = "";
    intentionalStop.current = false;
    pausedRef.current = false;

    if (typeof window === "undefined") return;

    const W = window as unknown as SpeechWindow;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) {
      setStatus("unsupported");
      setErrorMessage(
        "Trình duyệt không hỗ trợ Voice Search. Dùng Chrome/Edge trên HTTPS hoặc localhost."
      );
      return;
    }

    try {
      recRef.current?.abort?.();
    } catch {
      /* ignore */
    }

    const rec = new SR();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onstart = () => setStatus("listening");

    rec.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += t;
        else interim += t;
      }
      if (interim) onInterimRef.current?.(interim);
      if (finalText) {
        finalRef.current = (finalRef.current + " " + finalText).trim();
        onInterimRef.current?.(finalRef.current);
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorLike) => {
      const { status: st, message } = mapError(event?.error || "error");
      errorRef.current = message;
      setStatus(st);
      setErrorMessage(message);
    };

    rec.onend = () => {
      if (pausedRef.current) {
        setStatus("paused");
        return;
      }
      if (intentionalStop.current && !finalRef.current) {
        setStatus("idle");
        return;
      }
      const text = finalRef.current.trim();
      if (text) {
        setStatus("processing");
        setTimeout(() => {
          onFinalRef.current(text);
          setStatus("idle");
        }, 320);
      } else if (errorRef.current) {
        // keep mapped error status
        setStatus((s) =>
          s === "denied" || s === "unsupported" || s === "network" || s === "error" || s === "no-speech"
            ? s
            : "error"
        );
      } else if (!intentionalStop.current) {
        setStatus("no-speech");
        const msg = "Không nghe thấy giọng nói. Bấm micro để thử lại.";
        errorRef.current = msg;
        setErrorMessage(msg);
      } else {
        setStatus("idle");
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      setStatus("listening");
    } catch {
      setStatus("error");
      setErrorMessage("Không thể bắt đầu micro. Thử tải lại trang hoặc cho phép quyền micro.");
    }
  }, [lang]);

  const toggle = useCallback(() => {
    if (status === "listening") stop();
    else if (status === "paused") start();
    else start();
  }, [start, status, stop]);

  const restart = useCallback(() => {
    hardStop();
    setTimeout(() => start(), 80);
  }, [hardStop, start]);

  const supported =
    typeof window === "undefined"
      ? true
      : !!(window as unknown as SpeechWindow).SpeechRecognition ||
        !!(window as unknown as SpeechWindow).webkitSpeechRecognition;

  return {
    status,
    errorMessage,
    supported,
    start,
    stop,
    pause,
    hardStop,
    restart,
    toggle,
    isListening: status === "listening",
    isProcessing: status === "processing",
    isPaused: status === "paused",
  };
}
