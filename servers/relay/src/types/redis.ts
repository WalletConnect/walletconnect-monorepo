export declare type RedisCommandArgument = string | Buffer;

export interface StreamMessageReply {
  id: RedisCommandArgument;
  message: Record<string, RedisCommandArgument>;
}

export declare type StreamMessagesReply = Array<StreamMessageReply>;
export declare type StreamsMessagesReply = Array<{
  name: RedisCommandArgument;
  messages: StreamMessagesReply;
}> | null;
