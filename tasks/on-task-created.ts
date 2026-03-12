export default async function (event: any, ctx: any) {
  ctx.log.info('Task received', { payload: event.payload });
}
