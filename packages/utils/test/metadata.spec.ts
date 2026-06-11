import { vi, expect, describe, it } from "vitest";
import { SignClientTypes } from "@walletconnect/types";
import { populateAppMetadata } from "../src/misc";
import {
  isValidMetadataCustomData,
  getMetadataCustomDataSize,
  validateMetadataCustomData,
} from "../src/validators";
const mockedMetadata: SignClientTypes.Metadata = {
  name: "Mocked App Name",
  description: "Mocked App Description",
  url: "https://mocked-app.com",
  icons: ["https://mocked-app.com/icon.png"],
};
// Mock both getWindowMetadata and getAppMetadata
vi.mock("@walletconnect/window-metadata", () => {
  return {
    getWindowMetadata: vi.fn().mockReturnValue({
      name: "Mocked App Name",
      description: "Mocked App Description",
      url: "https://mocked-app.com",
      icons: ["https://mocked-app.com/icon.png"],
    }),
  };
});
describe("metadata", () => {
  it("should populate app metadata", () => {
    const metadata: SignClientTypes.Metadata = {
      name: "",
      description: "",
      url: "",
      icons: [""],
    };
    const populated = populateAppMetadata(metadata);
    expect(populated).to.eql(mockedMetadata);
  });
  it("should partially populate app metadata with empty metadata", () => {
    const metadata: SignClientTypes.Metadata = {
      name: "partially populated metadata",
      description: "",
      url: "",
      icons: [""],
    };
    const populated = populateAppMetadata(metadata);
    expect(populated).to.exist;
    expect(populated.description).to.eql(mockedMetadata.description);
    expect(populated.url).to.eql(mockedMetadata.url);
    expect(populated.icons).to.eql(mockedMetadata.icons);

    expect(populated.name).to.eql(metadata.name);
  });
  it("should partially populate app metadata with empty metadata. 2", () => {
    const metadata: SignClientTypes.Metadata = {
      name: "partially populated metadata",
      description: "",
      url: "",
      icons: ["test"],
    };
    const populated = populateAppMetadata(metadata);
    expect(populated.description).to.eql(mockedMetadata.description);
    expect(populated.url).to.eql(mockedMetadata.url);

    expect(populated.icons).to.eql(metadata.icons);
    expect(populated.name).to.eql(metadata.name);
  });
  it("should populate app metadata with empty metadata. 3", () => {
    const metadata: SignClientTypes.Metadata = {
      name: "",
      description: "",
      url: "https://something.com",
      icons: [""],
    };
    const populated = populateAppMetadata(metadata);
    expect(populated.description).to.eql(mockedMetadata.description);
    expect(populated.url).to.eql(mockedMetadata.url);
    expect(populated.icons).to.eql(mockedMetadata.icons);
  });

  it("should replace url if metadata.url differs from the actual page url", () => {
    const metadata: SignClientTypes.Metadata = {
      name: "Mocked App Name",
      description: "Mocked App Description",
      url: "https://something.com",
      icons: ["https://something.com/icon.png"],
    };
    const populated = populateAppMetadata(metadata);
    expect(populated.url).to.eql(mockedMetadata.url);
  });

  it("should not replace url if metadata.url hostname is the same as the actual page url with a trailing slash", () => {
    const metadata: SignClientTypes.Metadata = {
      name: "Mocked App Name",
      description: "Mocked App Description",
      url: "https://mocked-app.com/",
      icons: ["https://mocked-app.com/icon.png"],
    };
    const populated = populateAppMetadata(metadata);
    expect(populated.url).to.eql(metadata.url);
  });

  it("should not replace url if metadata.url hostname is the same as the actual page url", () => {
    const metadata: SignClientTypes.Metadata = {
      name: "Mocked App Name",
      description: "Mocked App Description",
      url: mockedMetadata.url,
      icons: mockedMetadata.icons,
    };
    const populated = populateAppMetadata(metadata);
    expect(populated.url).to.eql(metadata.url);
  });

  describe("customData validation", () => {
    it("should handle metadata with valid customData", () => {
      const metadata: SignClientTypes.Metadata = {
        name: "Test App",
        description: "Test Description",
        url: "https://test.com",
        icons: ["https://test.com/icon.png"],
        customData: {
          walletName: "WalletConnect - hot wallet",
          features: ["auth", "sign"],
          config: { theme: "dark" },
        },
      };
      const populated = populateAppMetadata(metadata);
      expect(populated.customData).to.eql(metadata.customData);
    });

    it("should remove customData that exceeds 1MB limit", () => {
      const largeData: Record<string, any> = {};
      const largeString = "x".repeat(1024 * 1024); // 1MB string
      largeData.largeField = largeString;

      const metadata: SignClientTypes.Metadata = {
        name: "Test App",
        description: "Test Description",
        url: "https://test.com",
        icons: ["https://test.com/icon.png"],
        customData: largeData,
      };
      const populated = populateAppMetadata(metadata);
      expect(populated.customData).to.be.undefined;
    });

    it("should handle metadata without customData", () => {
      const metadata: SignClientTypes.Metadata = {
        name: "Test App",
        description: "Test Description",
        url: "https://test.com",
        icons: ["https://test.com/icon.png"],
      };
      const populated = populateAppMetadata(metadata);
      expect(populated.customData).to.be.undefined;
    });
  });
});

describe("Metadata CustomData Validation", () => {
  describe("isValidMetadataCustomData", () => {
    it("should return true for undefined customData", () => {
      expect(isValidMetadataCustomData(undefined)).toBe(true);
    });

    it("should return true for empty object", () => {
      expect(isValidMetadataCustomData({})).toBe(true);
    });

    it("should return true for small customData", () => {
      const smallData = {
        version: "1.0.0",
        features: ["auth", "sign"],
        config: { theme: "dark" },
      };
      expect(isValidMetadataCustomData(smallData)).toBe(true);
    });

    it("should return false for customData exceeding 1MB", () => {
      const largeData: Record<string, any> = {};
      const largeString = "x".repeat(1024 * 1024); // 1MB string
      largeData.largeField = largeString;

      expect(isValidMetadataCustomData(largeData)).toBe(false);
    });

    it("should return false for invalid JSON serializable data", () => {
      const invalidData = {
        circular: {} as any,
      };
      invalidData.circular.self = invalidData.circular;

      expect(isValidMetadataCustomData(invalidData)).toBe(false);
    });
  });

  describe("getMetadataCustomDataSize", () => {
    it("should return 0 for undefined customData", () => {
      expect(getMetadataCustomDataSize(undefined)).toBe(0);
    });

    it("should return correct size for valid customData", () => {
      const data = { test: "value" };
      const expectedSize = new TextEncoder().encode(JSON.stringify(data)).length;
      expect(getMetadataCustomDataSize(data)).toBe(expectedSize);
    });

    it("should return 0 for invalid JSON serializable data", () => {
      const invalidData = {
        circular: {} as any,
      };
      invalidData.circular.self = invalidData.circular;

      expect(getMetadataCustomDataSize(invalidData)).toBe(0);
    });
  });

  describe("validateMetadataCustomData", () => {
    it("should return null for valid customData", () => {
      const data = {
        version: "1.0.0",
        features: ["auth", "sign"],
      };
      expect(validateMetadataCustomData(data, "test")).toBeNull();
    });

    it("should return null for undefined customData", () => {
      expect(validateMetadataCustomData(undefined, "test")).toBeNull();
    });

    it("should return error for customData exceeding 1MB", () => {
      const largeData: Record<string, any> = {};
      const largeString = "x".repeat(1024 * 1024); // 1MB string
      largeData.largeField = largeString;

      const error = validateMetadataCustomData(largeData, "test");
      expect(error).not.toBeNull();
      expect(error?.message).toContain("exceeds maximum size limit");
      expect(error?.message).toContain("1MB");
    });

    it("should include context in error message", () => {
      const largeData: Record<string, any> = {};
      const largeString = "x".repeat(1024 * 1024); // 1MB string
      largeData.largeField = largeString;

      const error = validateMetadataCustomData(largeData, "updateMetadata");
      expect(error?.message).toContain("updateMetadata");
    });
  });

  describe("Real-world usage examples", () => {
    it("should handle typical app metadata customData", () => {
      const typicalData = {
        appVersion: "2.1.0",
        buildNumber: "123",
        features: {
          auth: true,
          signing: true,
          notifications: false,
        },
        theme: {
          primary: "#0066cc",
          secondary: "#ffffff",
        },
        analytics: {
          enabled: true,
          trackingId: "UA-123456789-1",
        },
      };

      expect(isValidMetadataCustomData(typicalData)).toBe(true);
      expect(validateMetadataCustomData(typicalData, "app")).toBeNull();
    });

    it("should handle large but valid customData", () => {
      const data: Record<string, any> = {};
      const largeString = "x".repeat(500 * 1024); // 500KB string
      data.largeField = largeString;
      data.otherField = "additional data";

      expect(isValidMetadataCustomData(data)).toBe(true);
    });
  });
});
