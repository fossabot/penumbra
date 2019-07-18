import test from 'tape';

import penumbra from '../API';
import { ProgressEmit } from '../types';

import { timeout } from './helpers';
import { TimeoutManager } from './helpers/timeout';

test('v3 API: decrypt', async (t) => {
  const progressEventName = 'my-custom-event';
  const fail = () => {
    t.fail();
    t.end();
  };
  const initTimeout: TimeoutManager = timeout(fail, 60);
  let stallTimeout: TimeoutManager;
  let initFinished = false;
  let progressStarted = false;
  let lastPercent: number;
  const onprogress = (evt: ProgressEmit): void => {
    const { percent } = evt.detail;
    if (!Number.isNaN(percent)) {
      if (!initFinished) {
        initTimeout.clear();
        stallTimeout = timeout(fail, 10);
        initFinished = true;
        lastPercent = percent;
      } else if (!progressStarted) {
        if (percent > lastPercent) {
          stallTimeout.clear();
          progressStarted = true;
        }
      }
      if (progressStarted && percent > 25) {
        window.removeEventListener(progressEventName, onprogress);
        t.pass();
        t.end();
      }
    }
    lastPercent = percent;
  };

  window.addEventListener(progressEventName, onprogress);
  await penumbra.get({
    url: 'https://s3-us-west-2.amazonaws.com/bencmbrook/patreon.mp4.enc',
    mimetype: 'video/webm',
    decryptionOptions: {
      key: 'vScyqmJKqGl73mJkuwm/zPBQk0wct9eQ5wPE8laGcWM=',
      iv: '6lNU+2vxJw6SFgse',
      authTag: 'K3MVZrK2/6+n8/p/74mXkQ==',
    },
  });
});