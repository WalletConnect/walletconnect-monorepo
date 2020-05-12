declare module "*.svg" {
  const content: any;
  export = content;
}

declare module "*.css" {
  interface IClassNames {
    [className: string]: string;
  }
  const classNames: IClassNames;
  export = classNames;
  export default string;
}
