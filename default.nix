{
  sources ? import ./ops/nix/sources.nix,
  githash,
  tag,
  org ? "walletconnect",
}:
let
  pkgs =
    import
    sources.nixpkgs
    { overlays = [ (self: super: { npmlock2nix = pkgs.callPackage sources.npmlock2nix { }; }) ]; };
  buildNodeApp =
    {
      src,
      nodejs,
      pkgjson ? builtins.fromJSON (builtins.readFile (src + "/package.json")),
    }:
    let
      node_modules =
        pkgs.npmlock2nix.node_modules
        {
          inherit src nodejs;
          buildPhase = ''npm ci'';
        };
    in
      pkgs.stdenv.mkDerivation
      {
        src = src;
        pname = builtins.replaceStrings [ "@" "/" ] [ "_at_" "_slash_" ] pkgjson.name;
        version = "v${pkgjson.version}";
        buildInputs = [ nodejs ];
        buildPhase =
          ''
            ln -s ${node_modules}/node_modules ./node_modules
            ${nodejs}/bin/npm run compile
          '';
        installPhase =
          ''
            mkdir -p $out
            ln -s ${node_modules}/node_modules $out/node_modules
            cp -r dist/ $out/
            cp -r package.json $out/
          '';
      };
  buildDockerImage =
    {
      app,
      nodejs,
      githash,
      tag,
    }:
      pkgs.dockerTools.buildLayeredImage
      {
        name = "${org}/${pkgs.lib.lists.last (builtins.split "_slash_" app.pname)}";
        tag = tag;
        created = "now";
        config = {
          Cmd = [ "${nodejs}/bin/node" "${app}/dist" ];
          Env = [ "GITHASH=${githash}" ];
        };
      };
  filterSource = l: path: pkgs.nix-gitignore.gitignoreSourcePure (l ++ [ ./.gitignore ]) path;
in
{
  relay =
    buildDockerImage
    rec {
      inherit githash tag;
      nodejs = pkgs.nodejs-16_x;
      app =
        buildNodeApp
        {
          inherit nodejs;
          src = filterSource [ "dist" "test" ] ./servers/relay;
        };
    };
  health =
    buildDockerImage
    rec {
      inherit githash tag;
      nodejs = pkgs.nodejs-16_x;
      app =
        buildNodeApp
        {
          inherit nodejs;
          src = filterSource [ "dist" "test" ] ./servers/health;
        };
    };
}
