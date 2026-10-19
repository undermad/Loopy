import { answerTile, type TileRequest } from './finish';

self.onmessage = (event: MessageEvent<TileRequest>) => {
  void answerTile(event.data, (reply, transfer) => {
    self.postMessage(reply, { transfer });
  });
};
