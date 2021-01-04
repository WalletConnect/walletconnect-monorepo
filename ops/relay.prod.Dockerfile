FROM walletconnect/relay:base
USER relay
CMD ["node", "/relay/dist"]
