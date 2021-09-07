{
  pkgs ? import (import ./nix/sources.nix).nixpkgs {},
  wakuVersionTag,
  nixNimRepoSha256,
}:
let
  wakunode = (import(fetchTarball {
    url = "https://github.com/WalletConnect-Labs/nix-nim-waku/archive/${wakuVersionTag}.tar.gz";
    sha256 = nixNimRepoSha256;
  }) {});
  entry-script = with pkgs; writeScript "entry-script.sh" ''
    #!${runtimeShell}
    set -e
    export PATH=$PATH:${coreutils}/bin

    if [[ ! -e /mnt/nodekey ]]; then
      # https://stackoverflow.com/a/34329799
      od -vN "32" -An -tx1 /dev/urandom | tr -d " \n" > /mnt/nodekey
    fi

    mkdir -v /tmp
    ${wakunode}/bin/wakunode \
      --nat=none \
      --nodekey=$(cat /mnt/nodekey) \
      --rpc=true \
      --rpc-address=0.0.0.0 \
      --relay=false \
      --rln-relay=false \
      --store=false \
      --filter=false \
      --swap=false &
    PID=$!
    echo "Sleeping...."
    sleep 5 # wait for rpc server to start
    echo "Done!"

    while ! ${dnsutils}/bin/dig +short $SWARM_PEERS; do
      sleep 1
    done
    peerIPs=$(${dnsutils}/bin/dig +short $SWARM_PEERS)
    echo "Peer ip addresses: $peerIPs"
    peersArgs=""
    for ip in $peerIPs; do
      echo "IP $ip"
      while [ true ]; do
         ${curl}/bin/curl -s -d '{"jsonrpc":"2.0","id":"id","method":"get_waku_v2_debug_v1_info", "params":[]}' --header "Content-Type: application/json" http://$ip:8545
         result=$(${curl}/bin/curl -s -d '{"jsonrpc":"2.0","id":"id","method":"get_waku_v2_debug_v1_info", "params":[]}' --header "Content-Type: application/json" http://$ip:8545)
         multiaddr=$(echo -n $result | ${jq}/bin/jq -r '.result.listenStr')
         echo "Multiaddr $multiaddr"
         if [[ -n $multiaddr ]]; then
           multiaddr=$(${gnused}/bin/sed "s/0\.0\.0\.0/$ip/g" <<< $multiaddr)
           peersArgs="$peersArgs --staticnode=$multiaddr"
           break
         fi
         sleep 3
         echo -n .
      done
    done


    echo "Stopping background waku with PID: $PID"
    kill $PID
    peersArgs="$peersArgs --staticnode=$STORE"

    run="${wakunode}/bin/wakunode \
      --nat=none \
      --nodekey=$(${coreutils}/bin/cat /mnt/nodekey) \
      --keep-alive=true \
      --swap=false \
      --rln-relay=false \
      --rpc=true \
      --rpc-address=0.0.0.0 \
      --persist-peers=true \
      --metrics-server=true \
      --metrics-server-address=0.0.0.0 \
      --metrics-server-port=9001 \
      --relay=true \
      --store=true \
      --db-path=/store \
      --storenode=$STORE \
      $peersArgs
    "
    printf "\n\nCommand: $run\n\n"
    exec $run
  '';
in pkgs.dockerTools.buildLayeredImage {
  name =  "wakunode";
  contents = wakunode;
  created = "now";
  config = {
    Cmd = [
      "${entry-script}"
    ];
  };
}
