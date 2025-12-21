interface ExampleUser {
  id: string;
  name: string;
  email: string;
}

declare global {
  namespace Express {
    interface User extends ExampleUser {}
    interface Locals {
      startTime: number;
    }
  }
}
