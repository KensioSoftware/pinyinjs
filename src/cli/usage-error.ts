/**
 * Something the command line asked for that cannot be done.
 *
 * Its own module because both the parser and the option readers throw it, and
 * neither should have to import the other to do so.
 */
export class UsageError extends Error {}
