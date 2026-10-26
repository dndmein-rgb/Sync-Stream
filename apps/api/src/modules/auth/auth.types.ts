export type CreateUserData = {
  email: string;
  name: string;
  passwordHash: string;
  avatarUrl?:string|null
}

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export type SafeUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl:string|null
}