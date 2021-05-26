{ 
pkgs ? import (import ./servers/relay/nix/sources.nix).nixpkgs {}
, githash ? ""
}:
let
  nodejs = pkgs.nodejs-16_x;
  nodeEnv = import ./servers/relay/node-env.nix {
    inherit pkgs nodejs;
    inherit (pkgs) stdenv lib python2 runCommand writeTextFile;
    libtool = if pkgs.stdenv.isDarwin then pkgs.darwin.cctools else null;
  };
  relayPackages = import ./servers/relay/node-packages.nix {
    inherit nodeEnv;
    inherit (pkgs) fetchurl fetchgit nix-gitignore stdenv lib;
  };
  package = builtins.fromJSON (builtins.readFile ./servers/relay/package.json);
in rec {
  relay = pkgs.stdenv.mkDerivation {
    pname = builtins.replaceStrings [ "@" "/" ] [ "_at_" "_slash_" ] package.name;
    version = "v${package.version}";
    src = pkgs.nix-gitignore.gitignoreSource [ "result" ] ./servers/relay;
    buildInputs = [ nodejs ];
    buildPhase = ''
      export HOME=$TMP
      mkdir -p $out
      ln -s ${relayPackages.nodeDependencies}/lib/node_modules ./node_modules
    '';
    installPhase = ''
      ${nodejs}/bin/npm run compile
      ln -s ${relayPackages.nodeDependencies}/lib/node_modules $out/node_modules
      cp -r dist/ $out/
      cp -r package.json $out/
      export PATH=${nodejs}/bin:$PATH
    '';
  };
  docker = pkgs.dockerTools.buildLayeredImage {
    name = "relay";
    created = "now";
    config = {
      Cmd = [ "${nodejs}/bin/node" "${relay}/dist" ];
      Env = [
        "GITHASH=${githash}"
      ];
    };
  };
}
