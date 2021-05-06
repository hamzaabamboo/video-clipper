// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import { NextApiHandler } from "next";
import * as ytdl from "ytdl-core";

const dlVid: NextApiHandler = async (req, res) => {
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
    ytdl.downloadFromInfo(info, { quality: quality }).pipe(res);
  } catch (error) {
    res.status(400).send("Oops");
  }
};

export default dlVid;
