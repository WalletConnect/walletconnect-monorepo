{
  pkgs ? import (import ../servers/relay/nix/sources.nix).nixpkgs {}
}:
let
  statusImage = pkgs.dockerTools.pullImage {
    imageName = "walletconnect/waku";
    finalImageTag = "master";
    imageDigest = "sha256:20c09754d7798609a262e361e570cd8b33f31c653186534ab09f0c0abd819346";
    sha256 = "0szhcrhbz71fcnnl1py745jvf3mxh3mnd1k6zwgq2l6z3diy057a";
  };
  entry-script = with pkgs; writeScript "entry-script.sh" ''
    #!${runtimeShell}
    set -e
    wakuWC=$(${dnsutils}/bin/dig +short waku.walletconnect.org | ${coreutils}/bin/tr -d '\n')

    if [[ -z "$STORE" ]]; then
      echo "Getting store ip"
      while [ true ]; do
        storeIp=$(${dnsutils}/bin/dig +short store | ${coreutils}/bin/tr -d '\n')
        result=$(${curl}/bin/curl -s -d '{"jsonrpc":"2.0","id":"id","method":"get_waku_v2_debug_v1_info", "params":[]}' --header "Content-Type: application/json" http://store:8545)
        storeMultiaddr=$(echo -n $result | ${jq}/bin/jq -r '.result.listenStr')
        if [[ -n $storeMultiaddr ]]; then
          break
        fi
        sleep 3
        echo -n .
      done
    fi

    storeMultiaddr=$(sed "s/0\.0\.0\.0/$storeIp/g" <<< $storeMultiaddr)
    echo "STORE MULTI $storeMultiaddr"

    if [[ -n "$STORE" ]]; then
      echo "Running as local store"
      /usr/bin/wakunode \
        --topics=6d9b0b4b9994e8a6afbd3dc3ed983cd51c755afb27cd1dc7825ef59c134a39f7 \
        --keep-alive=true \
        --rpc=true \
        --rpc-address=0.0.0.0 \
        --persist-peers=true \
        --metrics-server=true \
        --metrics-server-address=0.0.0.0 \
        --metrics-server-port=9001 \
        --filter=true \
        --relay=true \
        --store=true \
        --db-path=/store \
        --staticnode=/ip4/$wakuWC/tcp/60000/p2p/16Uiu2HAmF1iLV2KdC7YUj99YKoqCYWSiMBq34mdmQX28J8k4kqmn \
        --storenode=/ip4/$wakuWC/tcp/60000/p2p/16Uiu2HAmF1iLV2KdC7YUj99YKoqCYWSiMBq34mdmQX28J8k4kqmn \

    else
      echo "Running as lightnode"
      /usr/bin/wakunode \
        --rpc-address=0.0.0.0 \
        --keep-alive=true \
        --persist-peers=true \
        --metrics-server=true \
        --metrics-server-address=0.0.0.0 \
        --metrics-server-port=9001 \
        --filter=true \
        --filternode=$storeMultiaddr \
        --storenode=$storeMultiaddr \

    fi
  '';
in
{
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
