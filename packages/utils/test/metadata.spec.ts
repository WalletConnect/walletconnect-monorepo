import { vi, expect, describe, it } from "vitest";
import { SignClientTypes } from "@walletconnect/types";
import { populateAppMetadata } from "../src/misc";
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
});
