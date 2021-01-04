FROM walletconnect/relay:base
USER node
CMD ["node", "/relay/dist"]
