// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import { NextApiHandler } from "next";
import * as ytdl from "ytdl-core";

const fetchVid: NextApiHandler = async (req, res) => {
  const url = req.query.url;
  if (!url || typeof url !== "string")
    return res.status(400).send("No Url Supplied");

  try {
    const info = await ytdl.getInfo(url, {
      requestOptions: {
        quality: "highest",
      },
    });
    res.status(200).send({
      data: info.formats[0],
      title: info.videoDetails.title,
      bestVideo: info.formats.find((t) => t.itag === 18),
      allFormats: info.formats,
    });
  } catch (error) {
    res.status(400).send("Oops");
  }
};

export default fetchVid;
