import { detect, BrowserInfo, BotInfo, NodeInfo } from "detect-browser";
import { IClientMeta } from "@walletconnect/types";

export function isMobile(): boolean {
  let mobile = false;

  function hasTouchEvent(): boolean {
    try {
      document.createEvent("TouchEvent");
      return true;
    } catch (e) {
      return false;
    }
  }

  function hasMobileUserAgent(): boolean {
    if (
      /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(
        navigator.userAgent,
      ) ||
      /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw-(n|u)|c55\/|capi|ccwa|cdm-|cell|chtm|cldc|cmd-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc-s|devi|dica|dmob|do(c|p)o|ds(12|-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(-|_)|g1 u|g560|gene|gf-5|g-mo|go(.w|od)|gr(ad|un)|haie|hcit|hd-(m|p|t)|hei-|hi(pt|ta)|hp( i|ip)|hs-c|ht(c(-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i-(20|go|ma)|i230|iac( |-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|-[a-w])|libw|lynx|m1-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|-([1-8]|c))|phil|pire|pl(ay|uc)|pn-2|po(ck|rt|se)|prox|psio|pt-g|qa-a|qc(07|12|21|32|60|-[2-7]|i-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h-|oo|p-)|sdk\/|se(c(-|0|1)|47|mc|nd|ri)|sgh-|shar|sie(-|m)|sk-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h-|v-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl-|tdg-|tel(i|m)|tim-|t-mo|to(pl|sh)|ts(70|-|m3|m5)|tx-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas-|your|zeto|zte-/i.test(
        navigator.userAgent.substr(0, 4),
      )
    ) {
      return true;
    } else if (hasTouchEvent()) {
      return true;
    }
    return false;
  }

  mobile = hasMobileUserAgent();

  return mobile;
}

export function getMeta(): IClientMeta | null {
  if (
    typeof window === "undefined" ||
    typeof window?.document === "undefined" ||
    typeof window?.location === "undefined"
  ) {
    return null;
  }

  function getIcons(): string[] {
    const links: HTMLCollectionOf<HTMLLinkElement> = document.getElementsByTagName("link");
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
              let absoluteHref: string = window.location.protocol + "//" + window.location.host;

              if (href.indexOf("/") === 0) {
                absoluteHref += href;
              } else {
                const path: string[] = window.location.pathname.split("/");
                path.pop();
                const finalPath: string = path.join("/");
                absoluteHref += finalPath + "/" + href;
              }

              icons.push(absoluteHref);
            } else if (href.indexOf("//") === 0) {
              const absoluteUrl: string = window.location.protocol + href;

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
    const metaTags: HTMLCollectionOf<HTMLMetaElement> = document.getElementsByTagName("meta");

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
      name = document.title;
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
  const url: string = window.location.origin;
  const icons: string[] = getIcons();

  const meta: IClientMeta = {
    description,
    url,
    icons,
    name,
  };

  return meta;
}

export function getQueryString(url: string): string {
  const pathEnd: number | undefined = url.indexOf("?") !== -1 ? url.indexOf("?") : undefined;

  const queryString: string = typeof pathEnd !== "undefined" ? url.substr(pathEnd) : "";

  return queryString;
}

export function appendToQueryString(queryString: string, newQueryParams: any): string {
  let queryParams = parseQueryString(queryString);

  queryParams = { ...queryParams, ...newQueryParams };

  queryString = formatQueryString(queryParams);

  return queryString;
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

export function formatQueryString(queryParams: any): string {
  let result = "";

  const keys = Object.keys(queryParams);

  if (keys) {
    keys.forEach((key: string, idx: number) => {
      const value = queryParams[key];
      if (idx === 0) {
        result = `?${key}=${value}`;
      } else {
        result = result + `&${key}=${value}`;
      }
    });
  }

  return result;
}

export function detectEnv(userAgent?: string): BrowserInfo | BotInfo | NodeInfo | null {
  return detect(userAgent);
}

export function isIOS(): boolean {
  const env = detectEnv();
  const result = env && env.os ? env.os.toLowerCase() === "ios" : false;
  return result;
}

export function isAndroid(): boolean {
  const env = detectEnv();
  const result = env && env.os ? env.os.toLowerCase() === "android" : false;
  return result;
}

export function isNode(): boolean {
  const env = detectEnv();
  const result = env && env.name ? env.name.toLowerCase() === "node" : false;
  return result;
}

export function isBrowser(): boolean {
  const result =
    !isNode() && typeof window !== "undefined" && typeof window.navigator !== "undefined";
  return result;
}
