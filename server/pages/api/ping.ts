// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import { NextApiHandler } from "next";

const ping: NextApiHandler = (req, res) => {
  res.status(200).json("pong");
};

export default ping;
