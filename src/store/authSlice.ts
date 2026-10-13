import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { SessionUserDTO } from "@/types/api";

export interface AuthState {
  user: SessionUserDTO | null;
  /** True until the first "who am I" answer arrives. */
  loading: boolean;
}

const slice = createSlice({
  name: "auth",
  initialState: { user: null, loading: true } as AuthState,
  reducers: {
    userLoaded(state, a: PayloadAction<SessionUserDTO | null>) {
      state.user = a.payload;
      state.loading = false;
    },
    authLoading(state, a: PayloadAction<boolean>) {
      state.loading = a.payload;
    },
  },
});

export const { userLoaded, authLoading } = slice.actions;
export const authReducer = slice.reducer;
export default authReducer;
