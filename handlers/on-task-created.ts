export default async function (event: any, ctx: any) {
  ctx.log.info('Event received', { payload: event.payload });
}
