{ 
pkgs ? import (import ./servers/relay/nix/sources.nix).nixpkgs {}
, githash ? ""
}:
let
  nodeEnv = import ./servers/relay/node-env.nix {
    inherit pkgs;
    inherit (pkgs) stdenv lib python2 runCommand writeTextFile;
    nodejs = pkgs.nodejs-14_x;
    libtool = if pkgs.stdenv.isDarwin then pkgs.darwin.cctools else null;
  };
  relayPackages = import ./servers/relay/node-packages.nix {
    inherit nodeEnv;
    inherit (pkgs) fetchurl fetchgit nix-gitignore stdenv lib;
  };
  package = builtins.fromJSON (builtins.readFile ./servers/relay/package.json);
  relay = pkgs.stdenv.mkDerivation {
    pname = builtins.replaceStrings [ "@" "/" ] [ "_at_" "_slash_" ] package.name;
    version = "v${package.version}";
    src = pkgs.nix-gitignore.gitignoreSource [ "result" ] ./servers/relay;
    buildInputs = [ pkgs.nodejs-14_x ];
    buildPhase = ''
      export HOME=$TMP
      mkdir -p $out
      ln -s ${relayPackages.nodeDependencies}/lib/node_modules ./node_modules
    '';
    installPhase = ''
      ${pkgs.nodejs-14_x}/bin/npm run compile
      ln -s ${relayPackages.nodeDependencies}/lib/node_modules $out/node_modules
      cp -r dist/ $out/
      cp -r package.json $out/
      export PATH=${pkgs.nodejs-14_x}/bin:$PATH
    '';
  };
in {
  # We are building directly from the waku image without nix
  # untils this works https://github.com/sbc64/nix-nim-waku
  #  or instead we package https://github.com/status-im/go-waku
  # with nix and we can use that nix derivation in this docker image.
  docker = pkgs.dockerTools.buildImage {
    fromImage = pkgs.dockerTools.pullImage {
      imageName = "sebohe/waku";
      finalImageTag = "master";
      imageDigest = "sha256:401de78e8c2a7c8b27513cca73693f0081472eb7cd10a2c3d9230f54f9b249a1";
      sha256 = "0nlb6vgagmwgbv5q3vmn5q4m3lg3hpk5r6n6vcpm46b354wdxm25";
    };
    name = "relay";
    created = "now";
    config = {
      Cmd = [ 
        "${pkgs.writeShellScript "entrypoint.sh" ''
          set -e
          ${pkgs.nodejs-14_x}/bin/node ${relay}/dist &
          /usr/bin/wakunode 
            --nodekey=bbf358ab08ab29d70b6b20845e4aa417124bb8051ecdbaf4f822bba18f28f7fb \
            --peerpersist=true \
            --rpc-address=0.0.0.0 \
            --rpc=true \
            --rpc-admin=true \
            --relay=true \
            --filter=true \
            --store=true \
            --filternode=/dnsaddr/store/tcp/60000/p2p/16Uiu2HAmF1iLV2KdC7YUj99YKoqCYWSiMBq34mdmQX28J8k4kqmn
            --storenode=/dnsaddr/store/tcp/60000/p2p/16Uiu2HAmF1iLV2KdC7YUj99YKoqCYWSiMBq34mdmQX28J8k4kqmn
        ''}"
      ];
      Env = [
        "GITHASH=${githash}"
      ];
    };
  };
}
