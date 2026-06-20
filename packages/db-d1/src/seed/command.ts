export const getDevelopmentSeedWranglerArguments = (
  artifactPath: string
): readonly string[] => [
  "d1",
  "execute",
  "Database",
  "--local",
  "--file",
  artifactPath,
];
