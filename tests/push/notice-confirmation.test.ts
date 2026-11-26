import {it,expect} from 'vitest';
import {noticeConfirmationPayload} from '../../src/features/push/policy';
it('uses the source menu, confirmer name and exact notice destination',()=>{expect(noticeConfirmationPayload('event',{noticeId:'notice-id',name:'박지영A'})).toMatchObject({title:'공지 · 읽음 확인',body:'박지영A님이 공지를 확인했습니다.',url:'/notices/notice-id',tag:'samduk45-event'});});
it('removes control characters and bounds the name without including notice content',()=>{const result=noticeConfirmationPayload('event',{noticeId:'id',name:' 예시\n 이름\u0000 '});expect(result.body).toBe('예시 이름님이 공지를 확인했습니다.');expect(noticeConfirmationPayload('e',{noticeId:'id',name:'가'.repeat(200)}).body.length).toBeLessThan(110);});
