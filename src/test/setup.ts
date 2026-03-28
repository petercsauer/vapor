import { beforeEach } from "vitest";
import { createVaporMock } from "./vapor-mock";
import { setVaporAPI } from "../renderer/api/vapor";

beforeEach(() => {
  if (typeof window !== "undefined") {
    const mock = createVaporMock();
    (window as any).vapor = mock;
    setVaporAPI(mock);
  }
});
