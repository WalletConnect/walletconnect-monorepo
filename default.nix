{ sources ? import ./ops/nix/sources.nix, githash ? "" }:
let
  organization = "walletconnect";
  pkgs = import sources.nixpkgs {
    overlays = [
      (self: super: {
        npmlock2nix = pkgs.callPackage sources.npmlock2nix { };
      })
    ];
  };
  buildNodeApp =
    { src
    , node_modules
    , pkgjson ? builtins.fromJSON (builtins.readFile (src + "/package.json"))
    }: pkgs.stdenv.mkDerivation {
      inherit src;
      pname = builtins.replaceStrings [ "@" "/" ] [ "_at_" "_slash_" ] pkgjson.name;
      version = "v${pkgjson.version}";
      buildInputs = [ node_modules.nodejs ];
      buildPhase = ''
        ln -s ${node_modules}/node_modules ./node_modules
        ${node_modules.nodejs}/bin/npm run compile
      '';
      installPhase = ''
        mkdir -p $out
        ln -s ${node_modules}/node_modules $out/node_modules
        cp -r dist/ $out/
        cp -r package.json $out/
      '';
    };
  buildDockerImage = { app, nodejs, githash }: pkgs.dockerTools.buildLayeredImage {
    name = "${organization}/${pkgs.lib.lists.last (builtins.split "_slash_" app.pname)}";
    tag = "${app.version}";
    config = {
      Cmd = [ "${nodejs}/bin/node" "${app}/dist" ];
      Env = [ "GITHASH=${githash}" ];
    };
  };
  build = { src, nodejs }: rec {
    app = buildNodeApp {
      inherit src;
      # remember that node_modules {} accepts mkDerivation attributes
      node_modules = pkgs.npmlock2nix.node_modules {
        inherit src nodejs;
        buildPhase = ''npm ci'';
      };
    };
    docker = buildDockerImage { inherit app githash nodejs; };
  };
in
{
  relay = build {
    nodejs = pkgs.nodejs-16_x;
    src = pkgs.nix-gitignore.gitignoreSourcePure [
      "dist"
      "test"
      ./.gitignore
    ] ./servers/relay;
  };
  health = build {
    nodejs = pkgs.nodejs-16_x;
    src = pkgs.nix-gitignore.gitignoreSourcePure [
      "dist"
      "test"
      ./.gitignore
    ] ./servers/health;
  };
}
