export type Brand<T, Name extends string> = T & {
  readonly __tableName: Name;
};

export const brand = <const Name extends string, T extends string>(
  value: T
): Brand<T, Name> => value as Brand<T, Name>;
