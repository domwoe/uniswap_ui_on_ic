export const idlFactory = ({ IDL }) => {
  return IDL.Service({
    'public_key' : IDL.Func(
        [],
        [
          IDL.Variant({
            'Ok' : IDL.Record({ 'public_key' : IDL.Vec(IDL.Nat8) }),
            'Err' : IDL.Text,
          }),
        ],
        [],
      ),
    'public_key_query' : IDL.Func(
        [],
        [
          IDL.Variant({
            'Ok' : IDL.Record({ 'public_key' : IDL.Vec(IDL.Nat8) }),
            'Err' : IDL.Text,
          }),
        ],
        ['query'],
      ),
    'sign' : IDL.Func(
        [IDL.Vec(IDL.Nat8)],
        [
          IDL.Variant({
            'Ok' : IDL.Record({ 'signature' : IDL.Vec(IDL.Nat8) }),
            'Err' : IDL.Text,
          }),
        ],
        [],
      ),
  });
};
export const init = ({ IDL }) => {
  return [
    IDL.Opt(
      IDL.Variant({
        'Production' : IDL.Null,
        'Development' : IDL.Null,
        'Staging' : IDL.Null,
      })
    ),
  ];
};
