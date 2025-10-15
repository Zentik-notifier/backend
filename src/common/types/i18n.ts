export interface TranslationKey {
  email: {
    passwordReset: {
      subject: string;
      title: string;
      description: string;
      codeInstructions: string;
      important: string;
      instructions1: string;
      instructions2: string;
      instructions3: string;
      regards: string;
      team: string;
    };
    welcome: {
      subject: string;
      title: string;
      description: string;
      instructions: string;
      regards: string;
      team: string;
    };
    confirmation: {
      subject: string;
      title: string;
      description: string;
      codeInstructions: string;
      important: string;
      instructions1: string;
      instructions2: string;
      regards: string;
      team: string;
    };
  };
  notifications: {
    actions: {
      markAsRead: string;
      open: string;
      delete: string;
      snooze: string;
      postpone: string;
    };
  };
}

export type Locale = 'en-EN' | 'it-IT';

export type Translation = TranslationKey;

export type GetTranslationValue<T extends string> =
  T extends keyof TranslationKey
    ? TranslationKey[T] extends string
      ? string
      : TranslationKey[T]
    : string;

type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}.${P}`
    : never
  : never;

type PathType<T> = {
  [K in keyof T]: T[K] extends object
    ? K extends string | number
      ? T[K] extends Array<any>
        ? K
        : K | Join<K, PathType<T[K]>>
      : never
    : K;
}[keyof T];

export type TranslationKeyPath = PathType<TranslationKey>;
