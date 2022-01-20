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
  nodejs = pkgs.nodejs-16_x;
  buildNodeApp =
    { src
    , nodeDeps
    , pkgjson ? builtins.fromJSON (builtins.readFile src + "/package.json")
    }: pkgs.stdenv.mkDerivation {
      inherit src;
      pname = builtins.replaceStrings [ "@" "/" ] [ "_at_" "_slash_" ] pkgjson.name;
      version = "v${pkgjson.version}";
      buildInputs = [ nodeDeps.nodejs ];
      buildPhase = ''
        export HOME=$TMP
        mkdir -p $out
        ln -s ${nodeDeps}/node_modules ./node_modules
        ${nodeDeps.nodejs}/bin/npm run compile
      '';
      installPhase = ''
        cp -r dist/ $out/
        cp -r package.json $out/
        export PATH=${nodeDeps}/bin:$PATH
      '';
  };
  buildDockerImage = {app, nodejs }: pkgs.dockerTools.buildLayeredImage {
    name = "${organization}/${pkgs.lib.lists.last (builtins.split "_slash_" app.pname)}";
      tag = "${app.version}";
      config = {
        Cmd = [ "${nodejs}/bin/node" "${app}/dist" ];
        Env = [
          "GITHASH=${githash}"
        ];
      };
    };

in
{
  relay = rec {
    path = ./servers/relay;
    node_modules = pkgs.npmlock2nix.node_modules {
      inherit nodejs;
      buildPhase = ''npm ci'';
      src = pkgs.nix-gitignore.gitignoreSourcePure [
        "dist"
        "node_modules"
        ".git"
      ] path;
    };
    app = buildNodeApp {
      pkgjson = builtins.fromJSON (builtins.readFile ./servers/relay/package.json);
      nodeDeps = node_modules;
      src = path;
    };
    docker = buildDockerImage{inherit app nodejs;};
  };
  health = rec {
    path = ./servers/health;
    node_modules = pkgs.npmlock2nix.node_modules {
      inherit nodejs;
      buildPhase = ''npm ci'';
      src = pkgs.nix-gitignore.gitignoreSourcePure [
        "dist"
        "node_modules"
        ".git"
      ] path;
    };
    app = buildNodeApp {
      pkgjson = builtins.fromJSON (builtins.readFile ./servers/relay/package.json);
      nodeDeps = node_modules;
      src = path;
    };
    docker = buildDockerImage{inherit app nodejs;};
  };
}
