while [ true ]; do
  curl -s -X GET "localhost:5432/test?url=wss://relay.walletconnect.org" | jq '.test.total.elapsed' &
  sleep 0.5
done
