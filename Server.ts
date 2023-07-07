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
import { Proxy } from "./Proxy";
import axios from "axios";
import { readFileSync } from "fs";
import https from "https";
import ansi from "ansi-colors";
import { ProxyConfig } from "../types";
import { parseTextToObj, parseText } from "./Utils";
import log from "log4js";

export class Server {
  public client: Client;
  public proxyNetID: number;
  public meta: string;
  public config: ProxyConfig;
  public proxy: Proxy;

  constructor(public ip: string, public port: number) {
    this.client = new Client({
      enet: {
        ip,
        port,
        maxPeers: 1024,
        useNewPacket: {
          asClient: false
        }
      },
      https: {
        port,
        enable: true,
        ip,
        type2: true
      }
    });
    this.client.toggleNewPacket();

    this.config = JSON.parse(readFileSync("./config.json", "utf8"));
    this.proxyNetID = 0;
  }

  public setProxyNetID(netID: number) {
    this.proxyNetID = netID;
  }

  public setProxy(proxy: Proxy) {
    this.proxy = proxy;
  }

  public setMeta(meta: string) {
    this.meta = meta;
  }

  public toFullBuffer(data: Buffer) {
    return data.toString("hex").match(/../g).join(" ");
  }

  public start() {
    this.client
      .on("ready", () => {
        log.getLogger("READY").info("Server Ready!");
      })
      .on("connect", async (netID) => {
        log.getLogger("CONNECT").info(`New Client connected to server: ${netID}`);

        this.proxy.setServerNetID(netID);

        const req = await this.request();
        console.log(req);
        if (this.proxy.usingSub) {
          req.server = this.proxy.subIP
          req.port = this.proxy.subPort
          console.log("using this")
          this.proxy.usingSub = 0;
        }
        this.setMeta(req.meta as string);
        if (this.proxy.client.connect((req.server as string).replace(/(\r)/gm, ""),parseInt((req.port as string).replace(/(\r)/gm, "")), 1))
          log.getLogger("CONNECT").info(`Successfully proxy connect to ${req.server}`);
      })
      .on("raw", (netID, data) => {
        const type = data.readUInt32LE(0);
        const peerProxy = new Peer(this.proxy.client, this.proxyNetID);
        const peer = new Peer(this.client, this.proxy.serverNetID);

        switch (type) {
          case PacketTypes.ACTION: {
            const parsed = parseTextToObj(data);

            if (parsed.action === "quit") {
              this.client._client.disconnect(netID);
            }

            log
              .getLogger(ansi.yellowBright("ACTION"))
              .info(`[${netID}] Server Received\n`, data.subarray(4).toString());

            break;
          }

          case PacketTypes.STR: {
            let str = data.subarray(4).toString();
            let strObj = parseTextToObj(str);

            if (strObj["requestedName"]) {
              strObj.meta = this.meta;
              strObj.country = "jp";
            }

            const buf = Buffer.alloc(4 + str.length);
            buf.writeUint32LE(2, 0);
            buf.write(parseText(strObj), 4);

            console.log(this.toFullBuffer(buf));
            data = buf;

            log
              .getLogger(ansi.cyan(`STRING`))
              .info(`[${netID}] Server Received\n`, data.subarray(4).toString());
            break;
          }

          case PacketTypes.TANK: {
            const tankType = data.readUint8(4);
            log
              .getLogger(ansi.blueBright(`TANK | Length: ${data.length}`))
              .info(`[${netID}] Server Received ${TankTypes[tankType]}`);

            switch (tankType) {
              case TankTypes.SEND_ITEM_DATABASE_DATA: {
                // ignore
                break;
              }

              case TankTypes.DISCONNECT: {
                this.client._client.disconnect(netID);
                // peerProxy.send(data);
                break;
              }

              case TankTypes.CALL_FUNCTION: {
                const variant = Variant.toArray(data);
                for (let a = 0; a < variant.length; a++) {
                  console.log("server variant: " + variant[a].type)
                }
                log
                  .getLogger(`${VariantTypes[variant[0].type]} | VariantList`)
                  .info("\n", variant.map((v) => `[${v.index}]: ${v.value}`).join("\n"));

                break;
              }

              default: {
                log.getLogger(`${TankTypes[tankType]}`).info(`${this.toFullBuffer(data)}`);
                break;
              }
            }

            break;
          }
        }
        peerProxy.send(data);
      })
      .on("disconnect", (netID) => {
        this.client._client.disconnect(netID);
        console.log("Client disconnected", netID);
      })
      .listen();
  }

  private async request() {
    const res = await axios({
      method: "POST",
      url: `https://${this.config.server.host}/growtopia/server_data.php`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "*/*",
        "User-Agent": "UbiServices_SDK_2019.Release.27_PC64_unicode_static"
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });

    if (res.status !== 200) return null;
    return parseTextToObj(res.data);
  }
}