import { expect } from 'chai';
import Session from '../helpers/session';

describe('paddle notification events', () => {
  beforeEach(Session.truncateDB);
  afterEach(Session.afterEach);
  after(Session.deleteBrowsers);

  it.only('is possible to retrieve the quota information of a user', async () => {
    const response = await fetch(`${process.env['SERVER_BASE_URL']}/quotaPaddleUpgrade`, {
      method: 'POST',
      body: '{"data":{"id":"sub_01jq68bfdbptwfsmffgkts2vmp","items":[{"price":{"id":"pri_01jnk9wfg57x3j5199xa1eng7d","name":"Beta version price per year","type":"standard","status":"active","quantity":{"maximum":1,"minimum":1},"tax_mode":"account_setting","seller_id":"28314","created_at":"2025-03-05T14:03:21.477051Z","product_id":"pro_01jnk9p7p2gekwkcayg833ec0p","unit_price":{"amount":"1900","currency_code":"USD"},"updated_at":"2025-03-05T14:03:21.477052Z","custom_data":null,"description":"Beta version price per year","import_meta":null,"trial_period":null,"billing_cycle":{"interval":"year","frequency":1},"unit_price_overrides":[]},"status":"active","product":{"id":"pro_01jnk9p7p2gekwkcayg833ec0p","name":"MonsterWriter 500MB Cloud","type":"standard","status":"active","image_url":"https://www.monsterwriter.com/logo-no-writing.png","seller_id":"28314","created_at":"2025-03-05T13:59:56.866Z","updated_at":"2025-03-05T14:15:43.272Z","custom_data":{"total_storage_available":"524288000"},"description":"Use MonsterWriter in the browser across your devices. Store all your documents in the MonsterWriter cloud.","tax_category":"standard"},"quantity":1,"recurring":true,"created_at":"2025-03-25T08:57:51.787Z","updated_at":"2025-03-25T08:57:51.787Z","trial_dates":null,"next_billed_at":"2026-03-25T08:57:50.7553Z","previously_billed_at":"2025-03-25T08:57:50.7553Z"}],"status":"active","discount":null,"paused_at":null,"address_id":"add_01jq68anq1nj82x13b78y4kyng","created_at":"2025-03-25T08:57:51.787Z","started_at":"2025-03-25T08:57:50.7553Z","updated_at":"2025-03-25T08:57:51.787Z","business_id":null,"canceled_at":null,"custom_data":{"nodeId":"foo"},"customer_id":"ctm_01jq4sr7x7tkb7k8gyhe2g224j","import_meta":null,"billing_cycle":{"interval":"year","frequency":1},"currency_code":"USD","next_billed_at":"2026-03-25T08:57:50.7553Z","transaction_id":"txn_01jq68aj5dmcg6zdbyqp8fhebt","billing_details":null,"collection_mode":"automatic","first_billed_at":"2025-03-25T08:57:50.7553Z","scheduled_change":null,"current_billing_period":{"ends_at":"2026-03-25T08:57:50.7553Z","starts_at":"2025-03-25T08:57:50.7553Z"}},"event_id":"evt_01jq68bg50983xa91342baw5mk","event_type":"subscription.created","occurred_at":"2025-03-25T08:57:52.544309Z","notification_id":"ntf_01jq68bg8wvr2c6c4wefzsmw28"}',
      headers: {
        // 'Content-Type': 'application/json',
        'Paddle-Signature': 'ts=1742893144;h1=1fc21d249ef488f75c5c4a41c505ba5957860a6d29840a371d0289e37acce046',
      },
    });

    expect(response.status).to.eql(200);
  });
});
