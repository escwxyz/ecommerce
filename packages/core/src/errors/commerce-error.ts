export abstract class CommerceError extends Error {
  readonly code: string;

  protected constructor(code: string, message: string) {
    super(message);
    this.name = "CommerceError";
    this.code = code;
  }
}
