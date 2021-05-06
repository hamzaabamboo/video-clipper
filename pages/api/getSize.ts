// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import { NextApiHandler } from "next";
import * as ytdl from "ytdl-core";
import https from "https";

const getSize: NextApiHandler = async (req, res) => {
  const url = req.query.url;
  const quality = req.query.quality;
  if (!url || typeof url !== "string" || typeof quality !== "string")
    return res.status(400).send("No Url Supplied");

  try {
    const info = await ytdl.getInfo(url, {
      requestOptions: {
        quality: quality,
      },
    });
    const stream = ytdl.downloadFromInfo(info, { quality: quality });
    const size = await new Promise((resolve) => {
      stream.on("info", (_, format) => {
        var parsed = new URL(format.url);
        https
          .request(
            parsed,
            {
              method: "HEAD",
            },
            (_res) => {
              resolve(_res.headers["content-length"]);
              stream.destroy();
            }
          )
          .end();
      });
    });
    res.send({ size });
  } catch (error) {
    res.status(400).send("Oops");
  }
};

export default getSize;
