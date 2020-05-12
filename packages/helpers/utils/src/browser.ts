import { IClientMeta } from "@walletconnect/types";

import {
  detect,
  BrowserInfo,
  BotInfo,
  NodeInfo,
  SearchBotDeviceInfo,
  ReactNativeInfo,
} from "detect-browser";

export function detectEnv(
  userAgent?: string,
): BrowserInfo | BotInfo | NodeInfo | SearchBotDeviceInfo | ReactNativeInfo | null {
  return detect(userAgent);
}

export function detectOS() {
  const env = detectEnv();
  return env && env.os ? env.os : undefined;
}

export function isIOS(): boolean {
  const os = detectOS();
  return os ? os.toLowerCase().includes("ios") : false;
}

export function isMobile(): boolean {
  const os = detectOS();
  return os ? os.toLowerCase().includes("android") || os.toLowerCase().includes("ios") : false;
}

export function isNode(): boolean {
  const env = detectEnv();
  const result = env && env.name ? env.name.toLowerCase() === "node" : false;
  return result;
}

export function isBrowser(): boolean {
  const result = !isNode() && !!getNavigatorUnsafe();
  return result;
}

export function unsafeGetFromWindow<T>(name: string): T | undefined {
  let res: T | undefined = undefined;
  if (typeof window !== "undefined" && typeof window[name] !== "undefined") {
    res = window[name];
  }
  return res;
}

export function safeGetFromWindow<T>(name: string): T {
  const res = unsafeGetFromWindow<T>(name);
  if (!res) {
    throw new Error(`${name} is not defined in Window`);
  }
  return res;
}

export function getDocument(): Document {
  return safeGetFromWindow<Document>("document");
}

export function getDocumentUnsafe(): Document | undefined {
  return unsafeGetFromWindow<Document>("document");
}

export function getNavigator(): Navigator {
  return safeGetFromWindow<Navigator>("navigator");
}

export function getNavigatorUnsafe(): Navigator | undefined {
  return unsafeGetFromWindow<Navigator>("navigator");
}

export function getLocation(): Location {
  return safeGetFromWindow<Location>("location");
}

export function getLocationUnsafe(): Location | undefined {
  return unsafeGetFromWindow<Location>("location");
}

export function getCrypto(): Crypto {
  return safeGetFromWindow<Crypto>("crypto");
}

export function getCryptoUnsafe(): Crypto | undefined {
  return unsafeGetFromWindow<Crypto>("crypto");
}

export function getLocalStorage(): Storage {
  return safeGetFromWindow<Storage>("localStorage");
}

export function getLocalStorageUnsafe(): Storage | undefined {
  return unsafeGetFromWindow<Storage>("localStorage");
}

export function getMeta(): IClientMeta | null {
  let doc: Document;
  let loc: Location;

  try {
    doc = getDocument();
    loc = getLocation();
  } catch (e) {
    return null;
  }

  function getIcons(): string[] {
    const links: HTMLCollectionOf<HTMLLinkElement> = doc.getElementsByTagName("link");
    const icons: string[] = [];

    for (let i = 0; i < links.length; i++) {
      const link: HTMLLinkElement = links[i];

      const rel: string | null = link.getAttribute("rel");
      if (rel) {
        if (rel.toLowerCase().indexOf("icon") > -1) {
          const href: string | null = link.getAttribute("href");

          if (href) {
            if (
              href.toLowerCase().indexOf("https:") === -1 &&
              href.toLowerCase().indexOf("http:") === -1 &&
              href.indexOf("//") !== 0
            ) {
              let absoluteHref: string = loc.protocol + "//" + loc.host;

              if (href.indexOf("/") === 0) {
                absoluteHref += href;
              } else {
                const path: string[] = loc.pathname.split("/");
                path.pop();
                const finalPath: string = path.join("/");
                absoluteHref += finalPath + "/" + href;
              }

              icons.push(absoluteHref);
            } else if (href.indexOf("//") === 0) {
              const absoluteUrl: string = loc.protocol + href;

              icons.push(absoluteUrl);
            } else {
              icons.push(href);
            }
          }
        }
      }
    }

    return icons;
  }

  function getMetaOfAny(...args: string[]): string {
    const metaTags: HTMLCollectionOf<HTMLMetaElement> = doc.getElementsByTagName("meta");

    for (let i = 0; i < metaTags.length; i++) {
      const tag: HTMLMetaElement = metaTags[i];
      const attributes: Array<string | null> = ["itemprop", "property", "name"]
        .map(target => tag.getAttribute(target))
        .filter(attr => {
          if (attr) {
            args.includes(attr);
          }
        });

      if (attributes.length && attributes) {
        const content: string | null = tag.getAttribute("content");
        if (content) {
          return content;
        }
      }
    }

    return "";
  }

  function getName(): string {
    let name: string = getMetaOfAny("name", "og:site_name", "og:title", "twitter:title");

    if (!name) {
      name = doc.title;
    }

    return name;
  }

  function getDescription(): string {
    const description: string = getMetaOfAny(
      "description",
      "og:description",
      "twitter:description",
      "keywords",
    );

    return description;
  }

  const name: string = getName();
  const description: string = getDescription();
  const url: string = loc.origin;
  const icons: string[] = getIcons();

  const meta: IClientMeta = {
    description,
    url,
    icons,
    name,
  };

  return meta;
}
