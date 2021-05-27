{
  pkgs ? import (import ../servers/relay/nix/sources.nix).nixpkgs {},
  tag ? "master"
}:
let
  statusImage = pkgs.dockerTools.pullImage {
    imageName = "walletconnect/waku";
    finalImageTag = tag;
    imageDigest = "sha256:84996a5107a67c2d2edd44fa00125107a36b674fa3dab3582f8ab36f688cafef";
    sha256 = "0szhcrhbz71fcnnl1py745jvf3mxh3mnd1k6zwgq2l6z3diy057a";
  };
  entry-script = with pkgs; writeScript "entry-script.sh" ''
    #!${runtimeShell}
    set -e
    wakuWC=$(${dnsutils}/bin/dig +short waku.walletconnect.org | ${coreutils}/bin/tr -d '\n')
    replicas=$${REPLICAS:-1}
    peersArgs=""
    for p in $PEERS; do
      peersArgs="$peersArgs --staticnode=$p"
    fi;

    peersArgs="$peersArgs --staticnode=$STORE"

    run="/usr/bin/wakunode \
      --keep-alive=true \
      --rpc=true \
      --rpc-address=0.0.0.0 \
      --persist-peers=true \
      --metrics-server=true \
      --metrics-server-address=0.0.0.0 \
      --metrics-server-port=9001 \
      --relay=true \
      --store=true \
      --db-path=/store \
      $PEERS
    "

    printf "\n\nCommand: $run\n\n"
    exec $run

  '';
in
{
  statusImage = statusImage;
  docker = pkgs.dockerTools.buildImage {
    name =  statusImage.imageName;
    fromImage = statusImage;
    fromImageName = statusImage.finalImageName;
    fromImageTag = statusImage.finalImageTag;
    contents = pkgs.bash;
    created = "now";
    config = {
      Cmd = [
        "${entry-script}"
      ];
    };
  };
}
