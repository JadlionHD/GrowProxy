import {
  Client,
  TextPacket,
  Peer,
  TankPacket,
  Variant,
  PacketTypes,
  TankTypes,
  VariantTypes
} from "growtopia.js";
import { Server } from "./Server";
import ansi from "ansi-colors";
import { parseText, parseTextToObj } from "./Utils";
import log from "log4js";

export class Proxy {
  public client: Client;
  public serverNetID: number;
  public server: Server;
  public onsendserver?: {
    ip: string;
    port: number;
    token: number;
    UUIDToken: string;
    doorID: string;
  };

  constructor(public ip: string, public port: number) {
    this.client = new Client({
      enet: {
        ip,
        port,
        maxPeers: 1024,
        useNewPacket: {
          asClient: true
        }
      },
      https: {
        ip,
        port,
        enable: false,
        type2: false
      }
    });

    if (this.client.config.enet.useNewPacket.asClient) this.client.toggleNewPacket();

    this.serverNetID = 0;
  }

  public setServerNetID(netID: number) {
    this.serverNetID = netID;
  }

  public setServer(server: Server) {
    this.server = server;
  }

  public setOnSend(obj: {
    ip: string;
    port: number;
    token: number;
    UUIDToken: string;
    doorID: string;
  }) {
    this.onsendserver = obj;
  }

  public toFullBuffer(data: Buffer) {
    return data.toString("hex").match(/../g).join(" ");
  }

  public start() {
    this.client
      .on("ready", () => {
        log.getLogger("READY").info("Proxy Ready!");
      })
      .on("connect", (netID) => {
        log.getLogger("CONNECT").info(`Proxy successfully connect`);

        this.server.setProxyNetID(netID);
      })
      .on("disconnect", (netID) => {
        console.log(`Proxy disconnect`, netID);
      })
      .on("raw", (netID, data) => {
        console.log(`[${netID}] Proxy Received`, this.toFullBuffer(data), "\n");
        const type = data.readUInt32LE(0);
        const peer = new Peer(this.server.client, this.serverNetID);
        const peerProxy = new Peer(this.client, netID);

        switch (type) {
          case PacketTypes.HELLO: {
            peer.send(data);
            break;
          }

          case PacketTypes.ACTION: {
            const parsed = parseTextToObj(data.subarray(4));

            log
              .getLogger(ansi.yellowBright("ACTION"))
              .info(`[${netID}] Proxy Received\n${data.subarray(4).toString()}`);
            peer.send(data);
            break;
          }

          case PacketTypes.STR: {
            log
              .getLogger(ansi.cyan(`STRING`))
              .info(`[${netID}] Proxy Received\n`, data.subarray(4).toString());
            peer.send(data);
            break;
          }

          case PacketTypes.TANK: {
            const tankType = data.readUint8(4);

            log
              .getLogger(ansi.blueBright(`TANK | Length: ${data.length}`))
              .info(`[${netID}] Proxy Received ${TankTypes[tankType]}`);

            switch (tankType) {
              case TankTypes.SEND_ITEM_DATABASE_DATA: {
                // ignore
                peer.send(data);
                break;
              }

              case TankTypes.CALL_FUNCTION: {
                const variant = Variant.toArray(data);

                log
                  .getLogger(`${VariantTypes[variant[0].type]} | VariantList`)
                  .info(
                    "\n",
                    variant.map((v) => `[${v.index} | ${v.typeName}]: ${v.value}`).join("\n")
                  );

                if (variant[0].typeName === "STRING" && variant[0].value === "OnConsoleMessage") {
                  const newText = `\`4[PROXY]\`\` ${variant[1].value}`;

                  data = Variant.from("OnConsoleMessage", newText).parse().parse();
                } else if (variant[0].typeName === "STRING" && variant[0].value === "OnSpawn") {
                  let obj = parseTextToObj(variant[1].value as string);
                  obj.mstate = "1";
                  obj.smstate = "0";

                  const parsed = parseText(obj);
                  data = Variant.from({ delay: -1 }, "OnSpawn", parsed).parse().parse();
                } else if (
                  variant[0].typeName === "STRING" &&
                  variant[0].value === "OnSendToServer"
                ) {
                  let obj = parseTextToObj(variant[4].value as string);
                  const tokenize = obj[Object.keys(obj)[0]] as string[];

                  // console.log(this.toFullBuffer(data));
                  this.setOnSend({
                    ip: Object.keys(obj)[0],
                    port: variant[1].value as number,
                    token: variant[2].value as number,
                    doorID: tokenize[0],
                    UUIDToken: tokenize[1]
                  });
                  data = Variant.from(
                    "OnSendToServer",
                    this.server.port,
                    // 17094,
                    // variant[1].value,
                    variant[2].value,
                    variant[3].value,
                    `127.0.0.1|${tokenize[0]}|${tokenize[1]}`,
                    // `${Object.keys(obj)[0]}|${tokenize[0]}|${tokenize[1]}`,
                    variant[5].value
                  )
                    .parse()
                    .parse();
                }
                // peerProxy.send(data);
                peer.send(data);

                break;
              }

              default: {
                log.getLogger(`${TankTypes[tankType]}`).info(`${this.toFullBuffer(data)}`);

                peer.send(data);

                break;
              }
            }

            break;
          }
        }

        // peer.send(data);
      })
      .listen();
  }
}
