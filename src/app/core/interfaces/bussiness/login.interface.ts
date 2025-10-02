
import { IUser } from "./user.interface";

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface ILogoutRequest {
  id: string;
}

export type ILoginResponse = Array<IUser>;