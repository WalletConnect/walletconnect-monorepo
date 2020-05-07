import { IClientMeta } from "@walletconnect/types";

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

export function parseQueryString(queryString: string): any {
  const result: any = {};

  const pairs = (queryString[0] === "?" ? queryString.substr(1) : queryString).split("&");

  for (let i = 0; i < pairs.length; i++) {
    const keyArr: string[] = pairs[i].match(/\w+(?==)/i) || [];
    const valueArr: string[] = pairs[i].match(/=.+/i) || [];
    if (keyArr[0]) {
      result[decodeURIComponent(keyArr[0])] = decodeURIComponent(valueArr[0].substr(1));
    }
  }

  return result;
}

export function getMeta(): IClientMeta | null {
  let doc: Document;
  let loc: Location;

  try {
    doc = safeGetFromWindow<Document>("document");
    loc = safeGetFromWindow<Location>("location");
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
