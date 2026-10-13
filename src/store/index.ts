import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector, useStore, type TypedUseSelectorHook } from "react-redux";
import { cacheReducer } from "./cacheSlice";
import { authReducer } from "./authSlice";

/** One store per browser session (created inside <StoreProvider>, never as a module singleton, so the server can't share it between requests). */
export function makeStore() {
  return configureStore({
    reducer: { apiCache: cacheReducer, auth: authReducer },
    middleware: (getDefault) =>
      // The cache holds large API payloads; the dev-mode "is this serializable / immutable" scans would walk all of them on every action.
      getDefault({ serializableCheck: false, immutableCheck: false }),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
export const useAppStore: () => AppStore = useStore;
