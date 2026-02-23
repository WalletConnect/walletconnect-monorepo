import { describe, expect, it } from "vitest";
import { isRetryableRelayError } from "../src";

describe("Error Utilities", () => {
  describe("isRetryableRelayError", () => {
    it("should return false for JWT validation errors (code 3000)", () => {
      const error = {
        error: {
          code: 3000,
          message: "JWT validation error: JWT Token is expired",
          data: "InvalidJwt",
        },
      };
      expect(isRetryableRelayError(error)).to.be.false;
    });

    it("should return false for authentication errors (3xxx range)", () => {
      const errors = [
        { error: { code: 3000, message: "JWT validation error" } },
        { error: { code: 3001, message: "Unauthorized method" } },
        { error: { code: 3500, message: "Invalid credentials" } },
        { error: { code: 3999, message: "Auth failed" } },
      ];

      errors.forEach((error) => {
        expect(isRetryableRelayError(error)).to.be.false;
      });
    });

    it("should return false for invalid request errors (1xxx range)", () => {
      const errors = [
        { error: { code: 1000, message: "Invalid request" } },
        { error: { code: 1001, message: "Invalid method" } },
        { error: { code: 1500, message: "Malformed request" } },
        { error: { code: 1999, message: "Invalid params" } },
      ];

      errors.forEach((error) => {
        expect(isRetryableRelayError(error)).to.be.false;
      });
    });

    it("should return false for user rejection errors (5xxx range)", () => {
      const errors = [
        { error: { code: 5000, message: "User rejected" } },
        { error: { code: 5001, message: "User rejected chains" } },
        { error: { code: 5100, message: "Unsupported chains" } },
        { error: { code: 5999, message: "User canceled" } },
      ];

      errors.forEach((error) => {
        expect(isRetryableRelayError(error)).to.be.false;
      });
    });

    it("should return true for network/connection errors (no error code)", () => {
      const errors = [
        new Error("Network error"),
        new Error("Connection timeout"),
        { message: "Socket closed" },
        null,
        undefined,
      ];

      errors.forEach((error) => {
        expect(isRetryableRelayError(error)).to.be.true;
      });
    });

    it("should return true for server errors (not in non-retryable ranges)", () => {
      const errors = [
        { error: { code: 500, message: "Internal server error" } },
        { error: { code: 503, message: "Service unavailable" } },
        { error: { code: 7000, message: "Session settlement failed" } },
        { error: { code: 9999, message: "Unknown error" } },
      ];

      errors.forEach((error) => {
        expect(isRetryableRelayError(error)).to.be.true;
      });
    });

    it("should handle errors with code at top level (not nested in error object)", () => {
      const nonRetryableError = { code: 3000, message: "JWT expired" };
      expect(isRetryableRelayError(nonRetryableError)).to.be.false;

      const retryableError = { code: 500, message: "Server error" };
      expect(isRetryableRelayError(retryableError)).to.be.true;
    });

    it("should return true for errors with non-numeric codes", () => {
      const errors = [
        { error: { code: "NETWORK_ERROR", message: "Network error" } },
        { error: { code: null, message: "Unknown error" } },
        { code: "TIMEOUT" },
      ];

      errors.forEach((error) => {
        expect(isRetryableRelayError(error)).to.be.true;
      });
    });

    it("should handle JSON-RPC error response format", () => {
      const jsonRpcError = {
        id: 0,
        jsonrpc: "2.0",
        error: {
          code: 3000,
          message: "JWT validation error: JWT Token is expired: Some(1756901830)",
          data: "InvalidJwt",
        },
      };
      expect(isRetryableRelayError(jsonRpcError)).to.be.false;
    });
  });
});
