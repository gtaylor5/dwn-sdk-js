import type { AuthCreateOptions } from '../../../core/types.js';
import type { CollectionsQueryDescriptor, CollectionsQueryMessage } from '../types.js';

import { DwnMethodName } from '../../../core/message.js';
import { getCurrentDateInHighPrecision } from '../../../utils/time.js';
import { Message } from '../../../core/message.js';
import { removeUndefinedProperties } from '../../../utils/object.js';
import { validateAuthorizationIntegrity } from '../../../core/auth.js';

export type CollectionsQueryOptions = AuthCreateOptions & {
  target: string;
  dateCreated?: string;
  filter: {
    recipient?: string;
    protocol?: string;
    contextId?: string;
    schema?: string;
    recordId?: string;
    parentId?: string;
    dataFormat?: string;
  },
  dateSort?: string;
};

export class CollectionsQuery extends Message {
  readonly message: CollectionsQueryMessage; // a more specific type than the base type defined in parent class

  private constructor(message: CollectionsQueryMessage) {
    super(message);
  }

  public static async parse(message: CollectionsQueryMessage): Promise<CollectionsQuery> {
    await validateAuthorizationIntegrity(message);

    if (message.descriptor.dateSort) {
      throw new Error('`dateSort` not implemented');
    }

    return new CollectionsQuery(message);
  }

  public static async create(options: CollectionsQueryOptions): Promise<CollectionsQuery> {
    const descriptor: CollectionsQueryDescriptor = {
      method      : DwnMethodName.CollectionsQuery,
      dateCreated : options.dateCreated ?? getCurrentDateInHighPrecision(),
      filter      : options.filter,
      dateSort    : options.dateSort
    };

    // delete all descriptor properties that are `undefined` else the code will encounter the following IPLD issue when attempting to generate CID:
    // Error: `undefined` is not supported by the IPLD Data Model and cannot be encoded
    removeUndefinedProperties(descriptor);

    Message.validateJsonSchema({ descriptor, authorization: { } });

    const authorization = await Message.signAsAuthorization(options.target, descriptor, options.signatureInput);
    const message = { descriptor, authorization };

    return new CollectionsQuery(message);
  }

  public async authorize(): Promise<void> {
    // DWN owner can do any query
    if (this.author === this.target) {
      return;
    }

    // extra checks if a recipient filter is specified
    const recipientDid = this.message.descriptor.filter.recipient;
    if (recipientDid !== undefined) {
      // make sure the recipient is the author
      if (recipientDid !== this.author) {
        throw new Error(`${this.author} is not allowed to query records intended for another recipient: ${recipientDid}`);
      }
    }
  }
}
