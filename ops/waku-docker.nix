{
  sources ? import ./nix/sources.nix,
}:
let
  pkgs = import sources.nixpkgs {};
  wakunode = import sources.nix-nim-waku {};
  entry-script = with pkgs; writeScript "entry-script.sh" ''
    #!${runtimeShell}
    set -e
    export PATH=$PATH:${coreutils}/bin:${wakunode}/bin

    if [[ ! -e /mnt/nodekey ]]; then
      # https://stackoverflow.com/a/34329799
      od -vN "32" -An -tx1 /dev/urandom | tr -d " \n" > /mnt/nodekey
    fi

    wakunode \
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
      while [ true ]; do
        echo "Calling ip: $ip"
        result=$(${curl}/bin/curl -s -d '{"jsonrpc":"2.0","id":"id","method":"get_waku_v2_debug_v1_info", "params":[]}' --header "Content-Type: application/json" http://$ip:8545)
        multiaddr=$(echo -n $result | ${jq}/bin/jq -r '.result.listenAddresses[0]')
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
    storeIp=$(${dnsutils}/bin/dig +short tasks.wakustore)
    echo "STORE IP: $storeIp"

    run="wakunode \
      --nat=none \
      --nodekey=$(cat /mnt/nodekey) \
      --keep-alive=true \
      --swap=false \
      --rpc=true \
      --rpc-address=0.0.0.0 \
      --persist-peers=true \
      --relay=true \
      --storenode=/ip4/$storeIp/tcp/60000/p2p/$STORE_NODE_KEY \
      --filternode=/ip4/$storeIp/tcp/60000/p2p/$STORE_NODE_KEY \
      $peersArgs
    "
    printf "\n\nCommand: $run\n\n"
    exec $run
  '';
in pkgs.dockerTools.buildLayeredImage {
  name =  "walletconnect/wakunode";
  tag = "${sources.nix-nim-waku.rev}";
  created = "now";
  config = {
    Env = [
      "PATH=${wakunode}/bin"
    ];
    Cmd = [
      "${entry-script}"
    ];
  };
}
