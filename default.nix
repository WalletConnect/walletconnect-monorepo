{ pkgs ? import (import ./ops/nix/sources.nix).nixpkgs {}, githash ? ""}:
with pkgs;
let
  nodejs = pkgs.nodejs-14_x;
  nodeEnv = import ./ops/node-env.nix {
    inherit pkgs nodejs stdenv lib python2 runCommand writeTextFile;
    libtool = if pkgs.stdenv.isDarwin then pkgs.darwin.cctools else null;
  };
  relay = rec {
    pkgjson = builtins.fromJSON (builtins.readFile ./servers/relay/package.json);
    packages = import ./servers/relay/node-packages.nix {
      inherit nodeEnv fetchurl fetchgit nix-gitignore stdenv lib;
    };
    app = pkgs.stdenv.mkDerivation {
      pname = builtins.replaceStrings [ "@" "/" ] [ "_at_" "_slash_" ] pkgjson.name;
      version = "v${pkgjson.version}";
      src = pkgs.nix-gitignore.gitignoreSource [ "test" ] ./servers/relay;
      buildInputs = [ nodejs ];
      buildPhase = ''
        export HOME=$TMP
        mkdir -p $out
        ln -s ${packages.nodeDependencies}/lib/node_modules ./node_modules
      '';
      installPhase = ''
        ${nodejs}/bin/npm run compile
        ln -s ${packages.nodeDependencies}/lib/node_modules $out/node_modules
        cp -r dist/ $out/
        cp -r package.json $out/
        export PATH=${nodejs}/bin:$PATH
      '';
    };
  };
  health = rec {
    pkgjson = builtins.fromJSON (builtins.readFile ./servers/health/package.json);
    packages = import ./servers/relay/node-packages.nix {
      inherit nodeEnv fetchurl fetchgit nix-gitignore stdenv lib;
    };
    app = pkgs.stdenv.mkDerivation {
      pname = builtins.replaceStrings [ "@" "/" ] [ "_at_" "_slash_" ] pkgjson.name;
      version = "v${pkgjson.version}";
      src = pkgs.nix-gitignore.gitignoreSource [ "test" ] ./servers/relay;
      buildInputs = [ nodejs ];
      buildPhase = ''
        export HOME=$TMP
        mkdir -p $out
        ln -s ${packages.nodeDependencies}/lib/node_modules ./node_modules
        ls ./node_modules
      '';
      installPhase = ''
        ${nodejs}/bin/npm run compile
        ln -s ${packages.nodeDependencies}/lib/node_modules $out/node_modules
        cp -r dist/ $out/
        cp -r package.json $out/
        export PATH=${nodejs}/bin:$PATH
      '';
    };
  };
in {
  relay = pkgs.dockerTools.buildLayeredImage {
    name = "relay";
    created = "now";
    config = {
      Cmd = [ "${nodejs}/bin/node" "${relay.app}/dist" ];
      Env = [
        "GITHASH=${githash}"
      ];
    };
  };
  health = pkgs.dockerTools.buildLayeredImage {
    name = "health";
    created = "now";
    config = {
      Cmd = [ "${nodejs}/bin/node" "${health.app}/dist" ];
    };
  };
}
